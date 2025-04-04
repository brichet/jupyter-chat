/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { classes } from '@jupyterlab/ui-components';
import { IconButton, IconButtonProps, TooltipProps } from '@mui/material';
import React from 'react';

import { ContrastingTooltip } from './contrasting-tooltip';

const TOOLTIPPED_WRAP_CLASS = 'jp-chat-tooltipped-wrap';

export type TooltippedIconButtonProps = {
  onClick: () => unknown;
  tooltip: string;
  children: JSX.Element;
  className?: string;
  disabled?: boolean;
  placement?: TooltipProps['placement'];
  /**
   * The offset of the tooltip popup.
   *
   * The expected syntax is defined by the Popper library:
   * https://popper.js.org/docs/v2/modifiers/offset/
   */
  offset?: [number, number];
  'aria-label'?: string;
  /**
   * Props passed directly to the MUI `IconButton` component.
   */
  iconButtonProps?: IconButtonProps;
};

/**
 * A component that renders an MUI `IconButton` with a high-contrast tooltip
 * provided by `ContrastingTooltip`. This component differs from the MUI
 * defaults in the following ways:
 *
 * - Shows the tooltip on hover even if disabled.
 * - Renders the tooltip above the button by default.
 * - Renders the tooltip closer to the button by default.
 * - Lowers the opacity of the IconButton when disabled.
 * - Renders the IconButton with `line-height: 0` to avoid showing extra
 * vertical space in SVG icons.
 */
export function TooltippedIconButton(
  props: TooltippedIconButtonProps
): JSX.Element {
  return (
    <ContrastingTooltip
      title={props.tooltip}
      placement={props.placement ?? 'top'}
      slotProps={{
        popper: {
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, -8]
              }
            }
          ]
        }
      }}
    >
      {/*
        By default, tooltips never appear when the IconButton is disabled. The
        official way to support this feature in MUI is to wrap the child Button
        element in a `span` element.

        See: https://mui.com/material-ui/react-tooltip/#disabled-elements
      */}
      <span className={classes(props.className, TOOLTIPPED_WRAP_CLASS)}>
        <IconButton
          {...props.iconButtonProps}
          onClick={props.onClick}
          disabled={props.disabled}
          sx={{
            marginLeft: '8px',
            lineHeight: 0,
            ...(props.disabled && { opacity: 0.5 })
          }}
          aria-label={props['aria-label']}
        >
          {props.children}
        </IconButton>
      </span>
    </ContrastingTooltip>
  );
}
