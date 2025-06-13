/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { LabIcon } from '@jupyterlab/ui-components';
import type {
  AutocompleteChangeReason,
  AutocompleteProps as GenericAutocompleteProps
} from '@mui/material';
import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { ChatCommand, IChatCommandRegistry } from '../../registers';
import { IInputModel, WHITESPACE } from '../../input-model';

type AutocompleteProps = GenericAutocompleteProps<any, any, any, any>;

type UseChatCommandsReturn = {
  autocompleteProps: Omit<AutocompleteProps, 'renderInput'>;
  pasteText: (sentence: string | null) => Promise<void>;
  menu: {
    open: boolean;
    highlighted: boolean;
  };
};

/**
 * A hook which automatically returns the list of command options given the
 * current input and chat command registry.
 *
 * Intended usage: `const chatCommands = useChatCommands(...)`.
 */
export function useChatCommands(
  inputModel: IInputModel,
  chatCommandRegistry?: IChatCommandRegistry
): UseChatCommandsReturn {
  // whether an option is highlighted in the chat commands menu
  const [highlighted, setHighlighted] = useState(false);

  // whether the chat commands menu is open
  const [open, setOpen] = useState(false);

  // current list of chat commands matched by the current word.
  // the current word is the space-separated word at the user's cursor.
  const [commands, setCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    inputModel.currentWordChanged.connect(updateCommands);

    return () => {
      inputModel.currentWordChanged.disconnect(updateCommands);
    };
  }, [inputModel]);

  async function updateCommands(model: IInputModel, _: string | null) {
    const newCommands = (await chatCommandRegistry?.getCommands(model)) || [];
    setCommands(newCommands);
    if (newCommands.length) {
      setOpen(true);
    } else {
      setOpen(false);
      setHighlighted(false);
    }
  }

  const pasteText = async (text: string | null): Promise<void> => {
    if (text === null) {
      return;
    }
    inputModel.currentWordChanged.disconnect(updateCommands);
    try {
      // const input = inputModel.value;
      let index =
        inputModel.cursorIndex ?? inputModel.value.length - text.length;
      // Keep the words number
      const count = text.split(/\s+/).length;

      // move index to the beginning of the first word
      while (
        index < inputModel.value.length &&
        WHITESPACE.has(inputModel.value[index])
      ) {
        index++;
      }

      for (let i = 0; i < count; i++) {
        console.log('INDEX', index);
        inputModel.cursorIndex = index;
        const commands =
          (await chatCommandRegistry?.getCommands(inputModel, true)) || [];
        console.log('COMMANDS', commands, inputModel.currentWord);
        if (commands.length) {
          // Keep only the first command
          const command = commands[0];
          // if replaceWith is set, handle the command immediately
          if (command.replaceWith) {
            inputModel.replaceCurrentWord(command.replaceWith);
            continue;
          }

          // otherwise, defer handling to the command provider
          chatCommandRegistry?.handleChatCommand(command, inputModel);
          index = inputModel.cursorIndex;
        } else {
          index =
            inputModel.cursorIndex + (inputModel.currentWord?.length ?? 0);
        }

        // Move index to the beginning of the next word
        while (
          index < inputModel.value.length &&
          WHITESPACE.has(inputModel.value[index])
        ) {
          index++;
        }
      }
      // console.log('WORDS', words);
      // for (const word of words) {
      //   console.log('WORD', word);
      //   // Add each word one by one to the input
      //   const index = inputModel.cursorIndex || inputModel.value.length;
      //   const start = inputModel.value.slice(0, index);
      //   const end = inputModel.value.slice(index);
      //   inputModel.value = start + word + end;
      //   inputModel.cursorIndex = index + word.length;

      //   // If the word in not a whitespace or empty word, check if it full matches a
      //   // commands to trigger it.
      //   if (word && !word.match(/\s+/)) {
      //     const commands =
      //       (await chatCommandRegistry?.getCommands(inputModel, true)) || [];
      //     console.log('COMMANDS', word, commands, inputModel.currentWord);
      //     if (commands.length) {
      //       // Keep only the first command
      //       const command = commands[0];
      //       // if replaceWith is set, handle the command immediately
      //       if (command.replaceWith) {
      //         inputModel.replaceCurrentWord(command.replaceWith);
      //         continue;
      //       }

      //       // otherwise, defer handling to the command provider
      //       chatCommandRegistry?.handleChatCommand(command, inputModel);
      //     }
      //   }
      // }
    } finally {
      inputModel.currentWordChanged.connect(updateCommands);
    }
  };

  /**
   * onChange(): the callback invoked when a command is selected from the chat
   * commands menu by the user.
   */
  const onChange: AutocompleteProps['onChange'] = (
    e: unknown,
    command: ChatCommand,
    reason: AutocompleteChangeReason
  ) => {
    if (reason !== 'selectOption') {
      // only call this callback when a command is selected by the user. this
      // requires `reason === 'selectOption'`.
      return;
    }

    if (!chatCommandRegistry) {
      return;
    }

    const currentWord = inputModel.currentWord;
    if (!currentWord) {
      return;
    }

    // if replaceWith is set, handle the command immediately
    if (command.replaceWith) {
      inputModel.replaceCurrentWord(command.replaceWith);
      return;
    }

    // otherwise, defer handling to the command provider
    chatCommandRegistry.handleChatCommand(command, inputModel);
  };

  return {
    autocompleteProps: {
      open,
      options: commands,
      getOptionLabel: (command: ChatCommand) => command.name,
      renderOption: (
        defaultProps,
        command: ChatCommand,
        __: unknown,
        ___: unknown
      ) => {
        const { key, ...listItemProps } = defaultProps;
        const commandIcon: JSX.Element = React.isValidElement(command.icon) ? (
          command.icon
        ) : (
          <span>
            {command.icon instanceof LabIcon ? (
              <command.icon.react />
            ) : (
              command.icon
            )}
          </span>
        );
        return (
          <Box key={key} component="li" {...listItemProps}>
            {commandIcon}
            <p className="jp-chat-command-name">{command.name}</p>
            {command.description && (
              <>
                <span> - </span>
                <p className="jp-chat-command-description">
                  {command.description}
                </p>
              </>
            )}
          </Box>
        );
      },
      // always show all options, since command providers should exclusively
      // define what commands are added to the menu.
      filterOptions: (commands: ChatCommand[]) => commands,
      value: null,
      autoHighlight: true,
      freeSolo: true,
      disableClearable: true,
      onChange,
      onHighlightChange:
        /**
         * On highlight change: set `highlighted` to whether an option is
         * highlighted by the user.
         *
         * This isn't called when an option is selected for some reason, so we
         * need to call `setHighlighted(false)` in `onClose()`.
         */
        (_, highlightedOption) => {
          setHighlighted(!!highlightedOption);
        },
      onClose:
        /**
         * On close: set `highlighted` to `false` and close the popup by
         * setting `open` to `false`.
         */
        () => {
          setHighlighted(false);
          setOpen(false);
        }
    },
    pasteText,
    menu: {
      open,
      highlighted
    }
  };
}
