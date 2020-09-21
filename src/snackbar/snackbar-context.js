/*
Copyright (c) 2018-2020 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/

// @flow

import * as React from 'react';
import ReactDOM from 'react-dom';

import {Layer} from '../layer/index.js';
import {getOverrides} from '../helpers/overrides.js';
import {useStyletron} from '../styles/index.js';

import {DURATION, PLACEMENT} from './constants.js';
import {SnackbarElement} from './snackbar-element.js';
import {StyledPlacementContainer} from './styled-components.js';
import type {
  SnackbarElementPropsT,
  SnackbarProviderPropsT,
  DurationT,
} from './types.js';

type ContextT = {|
  enqueue: (elementProps: SnackbarElementPropsT, duration?: DurationT) => void,
|};

export const SnackbarContext: React.Context<ContextT> = React.createContext({
  enqueue: () => {
    if (__DEV__) {
      console.warn('Snackbar context not found.');
    }
  },
});

export function useSnackbar() {
  const context = React.useContext(SnackbarContext);
  return {enqueue: context.enqueue};
}

export function SnackbarProvider({
  children,
  overrides = {},
  placement,
}: SnackbarProviderPropsT) {
  const [css, theme] = useStyletron();

  const [snackbars, setSnackbars] = React.useState([]);
  const [animating, setAnimating] = React.useState(false);

  const timeoutRef = React.useRef(null);

  const [containerHeight, setContainerHeight] = React.useState(0);
  const containerRef = React.useRef(null);

  function enqueue(elementProps, duration = DURATION.short) {
    setSnackbars(prev => {
      if (prev.length === 0) {
        enter(duration);
      }
      return [...prev, {elementProps, duration}];
    });
  }

  function dequeue() {
    setContainerHeight(0);

    setSnackbars(prev => {
      const next = prev.slice(1);
      if (next.length > 0) {
        enter(next[0].duration);
      }
      return next;
    });
  }

  function enter(duration) {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      display(duration);
    }, 500);
  }

  function exit() {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      dequeue();
    }, 500);
  }

  function display(duration) {
    timeoutRef.current = setTimeout(() => {
      exit();
    }, duration);
  }

  function handleMouseEnter() {
    clearTimeout(timeoutRef.current);
  }

  function handleMouseLeave(duration) {
    display(duration);
  }

  function handleActionClick() {
    clearTimeout(timeoutRef.current);
    exit();
  }

  React.useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setContainerHeight(entry.contentRect.height),
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [snackbars.length, animating]);

  const translateHeight = React.useMemo(() => {
    const value = containerHeight * 2 + 24;
    if (
      !placement ||
      placement === PLACEMENT.top ||
      placement === PLACEMENT.topLeft ||
      placement === PLACEMENT.topRight
    ) {
      return -1 * value;
    }
    return value;
  }, [placement, containerHeight]);

  const {
    PlacementContainer: PlacementContainerOverrides,
    ...snackbarOverrides
  } = overrides;
  const [PlacementContainer, placementContainerProps] = getOverrides(
    PlacementContainerOverrides,
    StyledPlacementContainer,
  );

  return (
    <SnackbarContext.Provider value={{enqueue}}>
      <div
        className={css({
          boxSizing: 'border-box',
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
        })}
        ref={containerRef}
      >
        {snackbars[0] && (
          <SnackbarElement
            {...snackbars[0].elementProps}
            overrides={{
              ...snackbarOverrides,
              ...snackbars[0].elementProps.overrides,
            }}
          />
        )}
      </div>

      {snackbars.length > 0 && containerHeight !== 0 && (
        <Layer>
          <PlacementContainer
            $animating={animating}
            $placement={placement}
            $translateHeight={translateHeight}
            {...placementContainerProps}
          >
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={() => handleMouseLeave(snackbars[0].duration)}
              className={css({display: 'inline', pointerEvents: 'all'})}
            >
              <SnackbarElement
                {...snackbars[0].elementProps}
                actionOnClick={event => {
                  if (snackbars[0].elementProps.actionOnClick) {
                    snackbars[0].elementProps.actionOnClick(event);
                  }
                  handleActionClick();
                }}
                overrides={{
                  ...snackbarOverrides,
                  ...snackbars[0].elementProps.overrides,
                }}
              />
            </div>
          </PlacementContainer>
        </Layer>
      )}

      {children}
    </SnackbarContext.Provider>
  );
}