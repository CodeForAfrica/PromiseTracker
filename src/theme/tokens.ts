export const tokens = {
  highlight: {
    main: "#005DFD", // blue
    light: "#FFB322", // yellow
    faded: "#90DAFF", // light blue
  },
  chart: {
    complete: "#005DFD",
    inprogress: "#90DAFF",
    inconclusive: "#909090",
    unstarted: "#EBEBEB",
    behindSchedule: "#FFB322",
    stalled: "#FF5255",
  },
  google: {
    main: "#4285F4",
  },
  status: {
    status0: { color: "#EBEBEB", textColor: "#202020" },
    status1: { color: "#FF5255", textColor: "#ffffff" },
    status2: { color: "#FFB322", textColor: "#202020" },
    status3: { color: "#90DAFF", textColor: "#202020" },
    status4: { color: "#909090", textColor: "#ffffff" },
    status5: { color: "#005DFD", textColor: "#ffffff" },
  },
  widths: {
    lg: 1080,
  },
} as const;

export type Tokens = typeof tokens;

