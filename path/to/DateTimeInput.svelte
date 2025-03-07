<script lang="ts">
  import cx from "classnames"
  import {DateInput} from "date-picker-svelte"
  import Input from "src/partials/Input.svelte"

  export let initialValue = null
  export let value = initialValue

  const className = cx(
    $$props.class,
    "rounded-full shadow-inset py-2 px-4 w-full placeholder:text-neutral-400",
    "bg-white border border-solid border-neutral-200 text-black pl-10",
  )

  const init = () => {
    if (!value) {
      value = new Date()
      value.setMinutes(0, 0, 0)
    }
  }

  const clear = () => {
    value = null
  }
</script>

<Input type="datetime" class={className} {...$$props} bind:value={value}>
  <button slot="before" type="button" class:opacity-0={!value} on:click={init}>
    <i class="fa fa-calendar-days"></i>
  </button>
  <DateInput format="yyyy-MM-dd HH:mm" bind:value />
  {#if value}
    <button
      slot="after"
      type="button"
      class="absolute right-0 top-0 m-px flex cursor-pointer gap-2 rounded-full px-4 pt-3 text-black opacity-75"
      on:click={clear}>
      <i class="fa fa-times"></i>
    </button>
  {/if}
</Input>
