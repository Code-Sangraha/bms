export const ROW_MENU_GAP_PX = 6;

/** Used before the portaled menu is measured; keeps last rows from opening downward into the fold. */
export const ROW_MENU_HEIGHT_ESTIMATE_PX = 200;

export type RowMenuComputedPosition = {
  placement: "above" | "below";
  top: number;
  bottom: number;
  right: number;
};

export function computeRowMenuPosition(
  rect: DOMRect,
  menuHeight: number
): RowMenuComputedPosition {
  const viewportH = window.innerHeight;
  const right = document.documentElement.clientWidth - rect.right;
  const spaceBelow = viewportH - rect.bottom - ROW_MENU_GAP_PX;
  const spaceAbove = rect.top - ROW_MENU_GAP_PX;

  const fitsBelow = spaceBelow >= menuHeight;
  const fitsAbove = spaceAbove >= menuHeight;

  if (fitsBelow) {
    return {
      placement: "below",
      top: rect.bottom + ROW_MENU_GAP_PX,
      bottom: 0,
      right,
    };
  }
  if (fitsAbove) {
    return {
      placement: "above",
      top: 0,
      bottom: viewportH - rect.top + ROW_MENU_GAP_PX,
      right,
    };
  }
  if (spaceAbove > spaceBelow) {
    return {
      placement: "above",
      top: 0,
      bottom: viewportH - rect.top + ROW_MENU_GAP_PX,
      right,
    };
  }
  return {
    placement: "below",
    top: rect.bottom + ROW_MENU_GAP_PX,
    bottom: 0,
    right,
  };
}
