<script lang="ts">
	export let value = null
	export let options = []
	export let onChange = null
	export let disabled = false
	export let multiple = false
	export let optionClass = ""

	const onClick = option => {
		if (multiple) {
			value = value.includes(option) ? value.filter(v => v !== option) : [...value, option]
		} else {
			value = option
		}

		onChange?.(value)
	}
</script>

<button
  class={$$props.class}
  class:cursor-pointer={!disabled}
  class:opacity-75={disabled}
  class:pointer-events-none={disabled}
  type="button">
	{#each options as option, i}
		<div class={optionClass} on:click={() => onClick(option)}>
			<slot
			  name="item"
			  {i}
			  {option}
			  active={multiple ? value.includes(option) : value === option} />
		</div>
	{/each}
</button>
