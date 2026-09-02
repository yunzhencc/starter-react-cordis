import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { baseKeymap } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface ChatComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  sendLabel: string;
}

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
  },
});

export function serializeComposerText(doc: ProseMirrorNode) {
  return doc.textBetween(0, doc.content.size, '\n');
}

export function ChatComposer({ disabled, onSend, sendLabel }: ChatComposerProps) {
  const [canSend, setCanSend] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const onSendRef = useRef(onSend);
  const disabledRef = useRef(disabled);
  const viewRef = useRef<EditorView | undefined>(undefined);

  onSendRef.current = onSend;
  disabledRef.current = disabled;

  const send = () => {
    const view = viewRef.current;
    if (!view || disabledRef.current)
      return false;

    const text = serializeComposerText(view.state.doc);
    if (!text.trim())
      return false;

    onSendRef.current(text);
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, schema.nodes.paragraph.create()));
    return true;
  };

  useLayoutEffect(() => {
    const view = new EditorView(hostRef.current!, {
      attributes: { 'aria-label': 'Message', 'aria-multiline': 'true', 'role': 'textbox' },
      dispatchTransaction(transaction) {
        const next = view.state.apply(transaction);
        view.updateState(next);
        setCanSend(serializeComposerText(next.doc).trim() !== '');
      },
      state: EditorState.create({
        plugins: [
          new Plugin({
            props: {
              handleKeyDown(editor, event) {
                if (event.key !== 'Enter' || event.shiftKey)
                  return false;
                if (event.isComposing || editor.composing)
                  return true;
                send();
                return true;
              },
            },
          }),
          history(),
          keymap(baseKeymap),
        ],
        schema,
      }),
    });
    viewRef.current = view;
    return () => {
      viewRef.current = undefined;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    viewRef.current?.setProps({ editable: () => !disabled });
  }, [disabled]);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      send();
    }}
    >
      <div ref={hostRef} />
      <button disabled={disabled || !canSend} type="submit">{sendLabel}</button>
    </form>
  );
}
