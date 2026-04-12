export const ROW_MENU_GAP_PX = 6;

/** Used before the portaled menu is measured; keeps last rows from opening downward into the fold. */
export const ROW_MENU_HEIGHT_ESTIMATE_PX = 200;

/** Matches `.rowMenuDropdown` min-width + borders; used to keep fixed menus inside the viewport. */
export const ROW_MENU_WIDTH_ESTIMATE_PX = 148;

const VIEWPORT_EDGE_GUTTER_PX = 8;

export type RowMenuComputedPosition = {
  placement: "above" | "below";
  top: number;
  bottom: number;
  right: number;
};

export type ComputeRowMenuPositionOptions = {
  /** When known (e.g. after measure), clamps horizontal placement more accurately. */
  menuWidth?: number;
};

export function computeRowMenuPosition(
  rect: DOMRect,
  menuHeight: number,
  options?: ComputeRowMenuPositionOptions
): RowMenuComputedPosition {
  const viewportH = window.innerHeight;
  const viewportW = document.documentElement.clientWidth;
  const menuW = Math.max(options?.menuWidth ?? ROW_MENU_WIDTH_ESTIMATE_PX, 1);
  let right = viewportW - rect.right;
  const maxRight = Math.max(VIEWPORT_EDGE_GUTTER_PX, viewportW - VIEWPORT_EDGE_GUTTER_PX - menuW);
  right = Math.min(Math.max(right, VIEWPORT_EDGE_GUTTER_PX), maxRight);
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
