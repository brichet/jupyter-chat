/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  Autocomplete,
  Box,
  InputAdornment,
  SxProps,
  TextField,
  Theme
} from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import { AttachmentPreviewList } from './attachments';
import { AttachButton, CancelButton, SendButton } from './input';
import { IChatModel } from '../model';
import { IAutocompletionRegistry } from '../registry';
import {
  AutocompleteCommand,
  IAttachment,
  IAutocompletionCommandsProps,
  IConfig,
  Selection
} from '../types';

const INPUT_BOX_CLASS = 'jp-chat-input-container';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { autocompletionName, autocompletionRegistry, documentManager, model } =
    props;

  const autocompletion = useRef<IAutocompletionCommandsProps>();
  const [input, setInput] = useState<string>(props.value || '');
  const [sendWithShiftEnter, setSendWithShiftEnter] = useState<boolean>(
    model.config.sendWithShiftEnter ?? false
  );
  const [typingNotification, setTypingNotification] = useState<boolean>(
    model.config.sendTypingNotification ?? false
  );
  const [attachments, setAttachments] = useState<IAttachment[]>([]);

  // Display the include selection menu if it is not explicitly hidden, and if at least
  // one of the tool to check for text or cell selection is enabled.
  let hideIncludeSelection = props.hideIncludeSelection ?? false;
  if (model.activeCellManager === null && model.selectionWatcher === null) {
    hideIncludeSelection = true;
  }

  // store reference to the input element to enable focusing it easily
  const inputRef = useRef<HTMLInputElement>();

  useEffect(() => {
    const configChanged = (_: IChatModel, config: IConfig) => {
      setSendWithShiftEnter(config.sendWithShiftEnter ?? false);
      setTypingNotification(config.sendTypingNotification ?? false);
    };
    model.configChanged.connect(configChanged);

    const focusInputElement = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    model.focusInputSignal?.connect(focusInputElement);

    const attachmentChanged = (_: IChatModel, attachments: IAttachment[]) => {
      setAttachments([...attachments]);
    };
    model.inputAttachmentsChanges?.connect(attachmentChanged);

    return () => {
      model.configChanged?.disconnect(configChanged);
      model.focusInputSignal?.disconnect(focusInputElement);
      model.inputAttachmentsChanges?.disconnect(attachmentChanged);
    };
  }, [model]);

  // The autocomplete commands options.
  const [commandOptions, setCommandOptions] = useState<AutocompleteCommand[]>(
    []
  );
  // whether any option is highlighted in the slash command autocomplete
  const [highlighted, setHighlighted] = useState<boolean>(false);
  // controls whether the slash command autocomplete is open
  const [open, setOpen] = useState<boolean>(false);

  const inputExists = !!input.trim();

  /**
   * Effect: fetch the list of available autocomplete commands.
   */
  useEffect(() => {
    if (autocompletionRegistry === undefined) {
      return;
    }
    autocompletion.current = autocompletionName
      ? autocompletionRegistry.get(autocompletionName)
      : autocompletionRegistry.getDefaultCompletion();

    if (autocompletion.current === undefined) {
      return;
    }

    if (Array.isArray(autocompletion.current.commands)) {
      setCommandOptions(autocompletion.current.commands);
    } else if (typeof autocompletion.current.commands === 'function') {
      autocompletion.current
        .commands()
        .then((commands: AutocompleteCommand[]) => {
          setCommandOptions(commands);
        });
    }
  }, []);

  /**
   * Effect: Open the autocomplete when the user types the 'opener' string into an
   * empty chat input. Close the autocomplete and reset the last selected value when
   * the user clears the chat input.
   */
  useEffect(() => {
    if (!autocompletion.current?.opener) {
      return;
    }

    if (input === autocompletion.current?.opener) {
      setOpen(true);
      return;
    }

    if (input === '') {
      setOpen(false);
      return;
    }
  }, [input]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && !open) {
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    // Do not send the message if the user was selecting a suggested command from the
    // Autocomplete component.
    if (highlighted) {
      return;
    }

    // Do not send empty messages, and avoid adding new line in empty message.
    if (!inputExists) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    if (
      (sendWithShiftEnter && event.shiftKey) ||
      (!sendWithShiftEnter && !event.shiftKey)
    ) {
      onSend();
      event.stopPropagation();
      event.preventDefault();
    }
  }

  /**
   * Triggered when sending the message.
   *
   * Add code block if cell or text is selected.
   */
  function onSend(selection?: Selection) {
    let content = input;
    if (selection) {
      content += `

\`\`\`
${selection.source}
\`\`\`
`;
    }
    props.onSend(content);
    setInput('');
  }

  /**
   * Triggered when cancelling edition.
   */
  function onCancel() {
    setInput(props.value || '');
    props.onCancel!();
  }

  // Set the helper text based on whether Shift+Enter is used for sending.
  const helperText = sendWithShiftEnter ? (
    <span>
      Press <b>Shift</b>+<b>Enter</b> to send message
    </span>
  ) : (
    <span>
      Press <b>Shift</b>+<b>Enter</b> to add a new line
    </span>
  );

  return (
    <Box sx={props.sx} className={clsx(INPUT_BOX_CLASS)}>
      <AttachmentPreviewList
        attachments={attachments}
        onRemove={model.removeAttachment}
      />
      <Autocomplete
        options={commandOptions}
        value={props.value}
        open={open}
        autoHighlight
        freeSolo
        // ensure the autocomplete popup always renders on top
        componentsProps={{
          popper: {
            placement: 'top'
          },
          paper: {
            sx: {
              border: '1px solid lightgray'
            }
          }
        }}
        ListboxProps={{
          sx: {
            '& .MuiAutocomplete-option': {
              padding: 2
            }
          }
        }}
        renderInput={params => (
          <TextField
            {...params}
            fullWidth
            variant="outlined"
            multiline
            onKeyDown={handleKeyDown}
            placeholder="Start chatting"
            inputRef={inputRef}
            sx={{ marginTop: '1px' }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <InputAdornment position="end">
                  {documentManager && model.addAttachment && (
                    <AttachButton
                      documentManager={documentManager}
                      onAttach={model.addAttachment}
                    />
                  )}
                  {props.onCancel && <CancelButton onCancel={onCancel} />}
                  <SendButton
                    model={model}
                    sendWithShiftEnter={sendWithShiftEnter}
                    inputExists={inputExists || attachments.length > 0}
                    onSend={onSend}
                    hideIncludeSelection={hideIncludeSelection}
                    hasButtonOnLeft={!!props.onCancel}
                  />
                </InputAdornment>
              )
            }}
            FormHelperTextProps={{
              sx: { marginLeft: 'auto', marginRight: 0 }
            }}
            helperText={input.length > 2 ? helperText : ' '}
          />
        )}
        {...autocompletion.current?.props}
        inputValue={input}
        onInputChange={(_, newValue: string) => {
          setInput(newValue);
          if (typingNotification && model.inputChanged) {
            model.inputChanged(newValue);
          }
        }}
        onHighlightChange={
          /**
           * On highlight change: set `highlighted` to whether an option is
           * highlighted by the user.
           *
           * This isn't called when an option is selected for some reason, so we
           * need to call `setHighlighted(false)` in `onClose()`.
           */
          (_, highlightedOption) => {
            setHighlighted(!!highlightedOption);
          }
        }
        onClose={
          /**
           * On close: set `highlighted` to `false` and close the popup by
           * setting `open` to `false`.
           */
          () => {
            setHighlighted(false);
            setOpen(false);
          }
        }
        // hide default extra right padding in the text field
        disableClearable
      />
    </Box>
  );
}

/**
 * The chat input namespace.
 */
export namespace ChatInput {
  /**
   * The properties of the react element.
   */
  export interface IProps {
    /**
     * The chat model.
     */
    model: IChatModel;
    /**
     * The initial value of the input (default to '')
     */
    value?: string;
    /**
     * The function to be called to send the message.
     */
    onSend: (input: string) => unknown;
    /**
     * The function to be called to cancel editing.
     */
    onCancel?: () => unknown;
    /**
     * Whether to allow or not including selection.
     */
    hideIncludeSelection?: boolean;
    /**
     * Custom mui/material styles.
     */
    sx?: SxProps<Theme>;
    /**
     * The document manager.
     */
    documentManager?: IDocumentManager;
    /**
     * Autocompletion properties.
     */
    autocompletionRegistry?: IAutocompletionRegistry;
    /**
     * Autocompletion name.
     */
    autocompletionName?: string;
  }
}
