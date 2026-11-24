import type * as React from "react";

/** <dot-loader>, vendored from RENDRlabworks/defacto-components (public/vendor/dot-loader). */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "dot-loader": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        pattern?: string;
        value?: number | string;
        loop?: boolean;
        label?: string;
        fill?: string;
      };
    }
  }
}
