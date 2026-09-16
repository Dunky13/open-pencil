use std::path::{Component, Path, PathBuf};

use url::Url;

#[derive(Debug, PartialEq, Eq)]
pub struct DeepLinkOpen {
    pub file: String,
    pub node: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum DeepLinkError {
    UnknownAction(String),
    MissingFile,
    AbsolutePath,
    ParentSegment,
    BadExtension,
}

pub fn parse_open_url(url: &Url) -> Result<DeepLinkOpen, DeepLinkError> {
    // openpencil://open?…  → host is the action.
    let action = url.host_str().unwrap_or("");
    if action != "open" {
        return Err(DeepLinkError::UnknownAction(action.to_string()));
    }
    let mut file = None;
    let mut node = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "file" => file = Some(v.into_owned()),
            "node" => node = Some(v.into_owned()),
            _ => {}
        }
    }
    let file = file
        .filter(|f| !f.is_empty())
        .ok_or(DeepLinkError::MissingFile)?;
    let is_windows_abs = file.len() > 1 && file.as_bytes()[1] == b':';
    if file.starts_with('/') || file.starts_with('\\') || is_windows_abs {
        return Err(DeepLinkError::AbsolutePath);
    }
    if file.split(['/', '\\']).any(|seg| seg == "..") {
        return Err(DeepLinkError::ParentSegment);
    }
    let lower = file.to_ascii_lowercase();
    if !(lower.ends_with(".pen") || lower.ends_with(".fig")) {
        return Err(DeepLinkError::BadExtension);
    }
    Ok(DeepLinkOpen {
        file,
        node: node.filter(|n| !n.is_empty()),
    })
}

/// Whether `candidate` ends with `suffix` as a whole sequence of path segments.
///
/// The link carries a repository-relative path, the candidate is an absolute path
/// from an open tab or the file picker, and the two may disagree on case: on
/// macOS and Windows the default filesystem is case-insensitive, so `Web/Design`
/// and `web/design` name the same file and a case-sensitive comparison would
/// cancel a link that points at an already open document.
///
/// The rule is per-platform, not per-volume: ASCII-case-insensitive on macOS and
/// Windows, exact on Linux. Deliberately ASCII only — macOS folds the full Unicode
/// case table, matching that here would mean carrying a Unicode fold for a gain
/// nobody links against. A case-sensitive APFS volume is likewise not probed;
/// the cost of being wrong there is a link that focuses a same-named file in a
/// different directory case, and no filesystem access is granted by this.
///
/// `candidate` is canonicalized so a `..`-laden or symlink-prefixed tab path still
/// compares by its real segments, and the literal path is tried as well: a symlink
/// *inside* the trailing segments (a monorepo `packages/web -> ../apps/web`) makes
/// the two disagree, and the link should match either spelling. A candidate that
/// cannot be canonicalized at all — the file moved, or the volume went away — is
/// compared by its literal segments alone rather than failing the match.
#[tauri::command]
pub fn path_matches_suffix(candidate: String, suffix: String) -> bool {
    let literal = PathBuf::from(&candidate);
    let canonical = literal.canonicalize().unwrap_or_else(|_| literal.clone());
    path_ends_with_segments(&canonical, &suffix) || path_ends_with_segments(&literal, &suffix)
}

fn segment_eq(left: &str, right: &str) -> bool {
    if cfg!(any(target_os = "macos", windows)) {
        left.eq_ignore_ascii_case(right)
    } else {
        left == right
    }
}

fn path_ends_with_segments(candidate: &Path, suffix: &str) -> bool {
    let wanted: Vec<&str> = suffix
        .split(['/', '\\'])
        .filter(|s| !s.is_empty())
        .collect();
    if wanted.is_empty() {
        return false;
    }
    let actual: Vec<String> = candidate
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    if actual.len() < wanted.len() {
        return false;
    }
    actual[actual.len() - wanted.len()..]
        .iter()
        .zip(&wanted)
        .all(|(have, want)| segment_eq(have, want))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> Result<DeepLinkOpen, DeepLinkError> {
        parse_open_url(&Url::parse(s).unwrap())
    }

    #[test]
    fn open_with_file_and_node() {
        assert_eq!(
            parse("openpencil://open?file=web%2Fdesign%2Fhikyo.pen&node=Button%2FPrimary"),
            Ok(DeepLinkOpen {
                file: "web/design/hikyo.pen".into(),
                node: Some("Button/Primary".into())
            })
        );
    }

    #[test]
    fn node_is_optional() {
        assert_eq!(parse("openpencil://open?file=a.pen").unwrap().node, None);
    }

    #[test]
    fn unknown_action() {
        assert_eq!(
            parse("openpencil://export?file=a.pen"),
            Err(DeepLinkError::UnknownAction("export".into()))
        );
    }

    #[test]
    fn missing_file() {
        assert_eq!(parse("openpencil://open"), Err(DeepLinkError::MissingFile));
    }

    #[test]
    fn absolute_refused() {
        assert_eq!(
            parse("openpencil://open?file=%2FUsers%2Fx%2Fa.pen"),
            Err(DeepLinkError::AbsolutePath)
        );
        assert_eq!(
            parse("openpencil://open?file=C%3A%5Cx%5Ca.pen"),
            Err(DeepLinkError::AbsolutePath)
        );
    }

    #[test]
    fn parent_segment_refused() {
        assert_eq!(
            parse("openpencil://open?file=..%2Fa.pen"),
            Err(DeepLinkError::ParentSegment)
        );
        // The dots themselves percent-encoded: decoding happens before the check.
        assert_eq!(
            parse("openpencil://open?file=%2E%2E%2Fa.pen"),
            Err(DeepLinkError::ParentSegment)
        );
    }

    #[test]
    fn extension_checked() {
        assert_eq!(
            parse("openpencil://open?file=a.txt"),
            Err(DeepLinkError::BadExtension)
        );
        assert!(parse("openpencil://open?file=a.fig").is_ok());
    }

    #[test]
    fn suffix_matches_whole_trailing_segments() {
        assert!(path_ends_with_segments(
            Path::new("/r/hikyo/web/design/hikyo.pen"),
            "web/design/hikyo.pen"
        ));
        // A partial segment is not a segment: `redesign` must not satisfy `design`.
        assert!(!path_ends_with_segments(
            Path::new("/r/redesign/hikyo.pen"),
            "design/hikyo.pen"
        ));
        // A suffix longer than the path cannot match.
        assert!(!path_ends_with_segments(
            Path::new("/hikyo.pen"),
            "design/hikyo.pen"
        ));
        assert!(!path_ends_with_segments(Path::new("/r/hikyo.pen"), ""));
    }

    #[test]
    fn suffix_case_rule_follows_the_platform() {
        let folded = path_ends_with_segments(
            Path::new("/r/hikyo/Web/Design/Hikyo.pen"),
            "web/design/hikyo.pen",
        );
        assert_eq!(folded, cfg!(any(target_os = "macos", windows)));
    }

    #[test]
    fn suffix_accepts_backslash_separators() {
        assert!(path_ends_with_segments(
            Path::new("/r/web/design/hikyo.pen"),
            "web\\design\\hikyo.pen"
        ));
    }
}
