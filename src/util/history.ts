// Adapted from https://raw.githubusercontent.com/EmilTholin/svelte-routing/master/src/history.js

type Listener = (update: { location: Location; action: string, preserveScroll?: boolean }) => void;
type NavigateOptions = { state?: any; replace?: boolean; preserveScroll?: boolean; blurActiveElement?: boolean };
type NavigateFn = (to: string, options?: NavigateOptions) => void;

interface HistorySource {
  readonly location: Location;
  addEventListener(name: string, fn: any): void;
  removeEventListener(name: string, fn: any): void;
  history: {
    readonly state: any;
    pushState(state: any, _: string, uri: string): void;
    replaceState(state: any, _: string, uri: string): void;
  };
}


const getLocation = (source: HistorySource) => {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial",
  };
};

const createHistory = (source: HistorySource) => {
  const listeners: Listener[] = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },

    listen(listener: Listener) {
      listeners.push(listener);

      const popstateListener = () => {
        location = getLocation(source);
        listener({location, action: "POP"});
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);
        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      };
    },

    navigate: (
      to: string,
      {state = {}, replace = false, preserveScroll = false, blurActiveElement = true}: NavigateOptions = {},
    ) => {
      try {
        if (replace) source.history.replaceState(state, "", to);
        else source.history.pushState(state, "", to);
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }
      location = getLocation(source);
      listeners.forEach(listener => listener({location, action: "PUSH", preserveScroll}));
      if (blurActiveElement) document.activeElement?.blur();
    },
  };
};

interface MemoryHistorySource extends HistorySource {
  history: MemoryHistory;
}

interface MemoryHistory extends History['history'] {
  readonly entries: Location[];
  readonly index: number;
  readonly state: any;
  pushState(state: any, _: string, uri: string): void;
  replaceState(state: any, _: string, uri: string): void;
}


// // Stores history entries in memory for testing or other platforms like Native
// const createMemorySource = (initialPathname = "/"): {
//   addEventListener: (_name: string, _fn: any) => void;
//   history: {
//     entries: {pathname: string; search: string}[];
//     index: number;
//     pushState: (state: any, _: string, uri: string) => void;
//     replaceState: (state: any, _: string, uri: string) => void;
//     state: any
//   };
//   location: {pathname: string; search: string};
//   removeEventListener: (_name: string, _fn: any) => void
// } => {
//   let index = 0;
//   const stack = [{pathname: initialPathname, search: ""}];
//   const states: any[] = [];
//
//   return {
//     get location() {
//       return stack[index];
//     },
//     addEventListener(_name: string, _fn: any) {},
//     removeEventListener(_name: string, _fn: any) {},
//     history: {
//       get entries() {
//         return stack;
//       },
//       get index() {
//         return index;
//       },
//       get state() {
//         return states[index];
//       },
//       pushState(state: any, _: string, uri: string) {
//         const [pathname, search = ""] = uri.split("?");
//         index++;
//         stack.push({pathname, search}); // Added key and hash to align with Location
//         states.push(state);
//       },
//       replaceState(state: any, _: string, uri: string) {
//         const [pathname, search = ""] = uri.split("?");
//         stack[index] = {pathname, search}; // Added key and hash
//         states[index] = state;
//       },
//     },
//   };
// };

// Global history uses window.history as the source if available,
// otherwise a memory history
const globalHistory = createHistory(window) as ReturnType<typeof createHistory> & { navigate: NavigateFn };
// const {navigate} = globalHistory;

export {globalHistory, createHistory};
