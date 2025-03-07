export type SwipeCustomEventDetail = {
  isTop: boolean
  deltaX: number
  deltaY: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export type SwipeCustomEvent = CustomEvent<SwipeCustomEventDetail>

export function swipe(
  node: HTMLElement,
  options: {
    thresholdX?: number
    thresholdY?: number
    direction?: "left" | "right" | "top" | "bottom"
  } = {
    direction: "top",
  },
) {
  const {direction} = options
  let startX: number | null = null
  let startY: number | null = null

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
  }

  function handleTouchMove(event: TouchEvent) {
    if (startX === null || startY === null) return

    const touch = event.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    const lateral = deltaX > 0 ? "right" : "left"
    const vertical = deltaY > 0 ? "top" : "bottom"

    const swipeX = lateral === direction
    const swipeY = vertical === direction

    if (!swipeX && !swipeY) return

    if (swipeX && Math.abs(deltaX) < Math.abs(2 * deltaY)) return
    if (swipeY && Math.abs(deltaY) < Math.abs(2 * deltaX)) return

    node.dispatchEvent(
      new CustomEvent<SwipeCustomEventDetail>("swipe", {
        detail: {
          isTop: node.scrollTop === 0,
          startX,
          startY,
          deltaX,
          deltaY,
          currentX: touch.clientX,
          currentY: touch.clientY,
        },
      } as SwipeCustomEvent),
    )
  }

  function handleTouchEnd(event: TouchEvent) {
    if (startX === null || startY === null) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    const lateral = deltaX > 0 ? "right" : "left"
    const vertical = deltaY > 0 ? "top" : "bottom"

    const swipeX = lateral === direction
    const swipeY = vertical === direction

    if (swipeX && swipeY) return

    if (swipeX && Math.abs(deltaX) < Math.abs(2 * deltaY)) return
    if (swipeY && Math.abs(deltaY) < Math.abs(2 * deltaX)) return

    node.dispatchEvent(
      new CustomEvent<SwipeCustomEventDetail>("end", {
        detail: {
          isTop: node.scrollTop === 0,
          startX,
          startY,
          deltaX,
          deltaY,
          currentX: touch.clientX,
          currentY: touch.clientY,
        },
      } as SwipeCustomEvent),
    )

    startX = null
    startY = null
  }

  node.addEventListener("touchstart", handleTouchStart as EventListener)
  node.addEventListener("touchmove", handleTouchMove as EventListener)
  node.addEventListener("touchend", handleTouchEnd as EventListener)

  return {
    destroy() {
      node.removeEventListener("touchstart", handleTouchStart as EventListener)
      node.removeEventListener("touchmove", handleTouchMove as EventListener)
      node.removeEventListener("touchend", handleTouchEnd as EventListener)
    },
  }
}
