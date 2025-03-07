<script lang="ts">
  import cx from "classnames"
  import { createEventDispatcher } from 'svelte';

  export let type:
    | "text"
    | "select"
    | "textarea"
    | "date"
    | "datetime"
    | "currency"
    | "search"
    | "image"
    | "range"
    | "number" = "text";
  export let value: any = "";
  export let element: any = null;
  export let hideBefore = false;
  export let hideAfter = false;
  export let dark = false;
  export let placeholder = "";
  export let format: (x: any) => string = null;
  export let parse: (x: string) => any = null;
  export let options: any[] = []; // For select type
  export let multiple: boolean = false; // For select type

  const showBefore = $$slots.before && !hideBefore;
  const showAfter = $$slots.after && !hideAfter;
  const dispatch = createEventDispatcher();

  const onInput = (e) => {
    let parsedValue;
    if (parse) {
      parsedValue = parse(e.target.value);
    } else if (["range", "number"].includes(type)) {
      parsedValue = parseFloat(e.target.value);
    } else {
      parsedValue = e.target.value;
    }
    value = parsedValue;
    dispatch('input', parsedValue);
  };

  const onChange = (e) => {
    dispatch('change', value);
  };

  const onBlur = (e) => {
    dispatch('blur', value);
  };

  const onFocus = (e) => {
    dispatch('focus', value);
  };

  const onKeydown = (e) => {
    dispatch('keydown', e);
  };

  $: inputValue = format ? format(value) : value;

</script>

<div
  class={cx($$props.class, "shadow-inset relative h-7 overflow-hidden rounded", {
    "!bg-transparent": type === "range",
    "bg-neutral-900 text-neutral-100": dark,
    "bg-white dark:text-neutral-900": !dark,
  })}
>
  <svelte:element
    this={type === 'select' ? 'select' : 'input'}
    {...$$props}
    type={type === 'select' ? undefined : type}
    class={cx("h-7 w-full bg-transparent px-3 pb-px outline-none placeholder:text-neutral-400", {
      "pl-10": showBefore,
      "pr-10": showAfter,
    })}
    value={type === 'select' ? undefined : inputValue}
    bind:value={type === 'select' ? value : undefined}
    bind:this={element}
    placeholder={placeholder}
    on:input={onInput}
    on:change={onChange}
    on:blur={onBlur}
    on:focus={onFocus}
    on:keydown={onKeydown}
    {multiple}
  >
    {#if type === 'select'}
      <slot /> <!-- Options for select will be slotted here -->
    {/if}
  </svelte:element>
  {#if showBefore}
    <div class="absolute left-0 top-0 flex h-7 items-center gap-2 px-3 opacity-75">
      <div>
        <slot name="before" />
      </div>
    </div>
  {/if}
  {#if showAfter}
    <div
      class="absolute right-0 top-0 m-px flex h-7 items-center gap-2 rounded-full px-3 opacity-75"
    >
      <div>
        <slot name="after" />
      </div>
    </div>
  {/if}
</div>
