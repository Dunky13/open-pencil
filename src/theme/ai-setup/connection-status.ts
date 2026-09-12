export default {
  slots: {
    root: 'inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted',
    dot: 'size-1.5 rounded-full bg-muted data-[status=connected]:bg-success data-[status=ready]:bg-success data-[status=starting]:bg-amber-400 data-[status=sign-in]:bg-amber-400 data-[status=unavailable]:bg-danger'
  }
}
