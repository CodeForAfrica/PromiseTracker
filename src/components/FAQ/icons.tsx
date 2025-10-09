import { SvgIcon } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";

export const PlusIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 21 20" htmlColor="#202020" {...props}>
    <path
      d="M344,89v2h-9.45v9h-2.1V91H323V89h9.45V80h2.1v9Z"
      transform="translate(-323 -80)"
      fillRule="evenodd"
    />
  </SvgIcon>
);

export const MinusIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 21 20" htmlColor="#202020" {...props}>
    <path d="M19 13H5v-2h14v2z" fillRule="evenodd" />
  </SvgIcon>
);

export default PlusIcon;
