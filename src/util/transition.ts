import {cubicOut} from "svelte/easing"
import {fade as svelteFade, fly as svelteFly, slide as svelteSlide, type TransitionConfig} from "svelte/transition"

// Fly animation kills safari for some reason, use a modified fade instead
export const fly: (node: Element, params?: TransitionConfig) => TransitionConfig = window['safari']
  ? (node, params) => svelteFade(node, {duration: 100, ...params})
  : svelteFly
export const fade = svelteFade
export const slide = svelteSlide

// Copy-pasted and tweaked from slide source code
export function slideAndFade(
  node: Element,
  {delay = 0, duration = 400, easing = cubicOut, axis = "y"} = {},
): TransitionConfig {
  const style = getComputedStyle(node)
  const primaryProperty = axis === "y" ? "height" : "width"
  const primaryPropertyValue = parseFloat(style[primaryProperty])
  const secondaryProperties = axis === "y" ? ["top", "bottom"] : ["left", "right"]
  const capitalizedSecondaryProperties = secondaryProperties.map(
    (e: string) => `${e[0].toUpperCase()}${e.slice(1)}`,
  )
  const paddingStartValue = parseFloat(style[`padding${capitalizedSecondaryProperties[0]}`])
  const paddingEndValue = parseFloat(style[`padding${capitalizedSecondaryProperties[1]}`])
  const marginStartValue = parseFloat(style[`margin${capitalizedSecondaryProperties[0]}`])
  const marginEndValue = parseFloat(style[`margin${capitalizedSecondaryProperties[1]}`])
  const borderWidthStartValue = parseFloat(
    style[`border${capitalizedSecondaryProperties[0]}Width`],
  )
  const borderWidthEndValue = parseFloat(
    style[`border${capitalizedSecondaryProperties[1]}Width`],
  )
  return {
    delay,
    duration,
    easing,
    css: (t: number) =>
      "overflow: hidden;" +
      `opacity: ${t};` +
      `${primaryProperty}: ${t * primaryPropertyValue}px;` +
      `padding-${secondaryProperties[0]}: ${t * paddingStartValue}px;` +
      `padding-${secondaryProperties[1]}: ${t * paddingEndValue}px;` +
      `margin-${secondaryProperties[0]}: ${t * marginStartValue}px;` +
      `margin-${secondaryProperties[1]}: ${t * marginEndValue}px;` +
      `border-${secondaryProperties[0]}-width: ${t * borderWidthStartValue}px;` +
      `border-${secondaryProperties[1]}-width: ${t * borderWidthEndValue}px;`,
  }
}
