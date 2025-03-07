<script lang="ts">
	import cx from "classnames"

	export let autofocus = false
	export let placeholder = null

	let input = null
	let showPlaceholder = true

	const stripStyle = node => {
		if (node.tagName === "IMG") {
			node.remove()
		} else if (node instanceof HTMLElement) {
			if (!node.dataset?.coracle) {
				node.removeAttribute("class")
				node.removeAttribute("style")
				node.removeAttribute("color")
				node.removeAttribute("size")
				node.removeAttribute("face")
			}

			for (const child of node.childNodes) {
				// @ts-ignore
				if (!child.dataset?.coracle) {
					stripStyle(child)
				}
			}
		}
	}

	export const onInput = () => {
		const selection = window.getSelection()
		const {focusNode, focusOffset} = selection

		// Remove gunk that gets copy/pasted, or bold/italic tags that can be added with hotkeys
		for (const child of input.childNodes) {
			stripStyle(child)
		}

		// If we're editing something we've already linked, un-link it
		// @ts-ignore
		if (focusNode.parentNode?.dataset?.coracle) {
			// @ts-ignore
			focusNode.parentNode.replaceWith(focusNode)
			selection.collapse(focusNode, focusOffset)
			input.normalize()
		}

		showPlaceholder = input.textContent.length === 0
	}

	export const getInput = () => input

	const parseNode = (node, content = "", annotations = []) => {
		for (const child of node.childNodes) {
			if (child.tagName === "BR") {
				content += "\n"
			}

			if (child.tagName === "DIV" && !content.match(/\n\s*$/)) {
				content += "\n"
			}

			// @ts-ignore
			if (child.dataset?.coracle) {
				const {prefix, value} = JSON.parse(child.dataset.coracle)

				content += value
				annotations.push({prefix, value})
			} else if (child instanceof Text) {
				content += child.textContent
			} else {
				;({content, annotations} = parseNode(child, content, annotations))
			}

			if (child.tagName === "DIV" && !content.match(/\n\s*$/)) {
				content += "\n"
			}
		}

		return {content, annotations}
	}

	export const parse = () => parseNode(input)
</script>

<div class="min-w-0 flex-grow">
	<div class="h-0 text-neutral-300" class:hidden={!showPlaceholder}>
		{placeholder || ""}
	</div>
	<div
	  {autofocus}
	  bind:this={input}
	  class={cx($$props.class, "w-full min-w-0 whitespace-pre-line outline-0")}
	  contenteditable
	  on:input={onInput}
	  on:keydown
	  on:keyup
	  style={$$props.style || "min-height: 6rem"} />
</div>
