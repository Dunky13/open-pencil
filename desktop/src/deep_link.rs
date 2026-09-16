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
    }

    #[test]
    fn extension_checked() {
        assert_eq!(
            parse("openpencil://open?file=a.txt"),
            Err(DeepLinkError::BadExtension)
        );
        assert!(parse("openpencil://open?file=a.fig").is_ok());
    }
}
