# Directive syntax parser

[![NPM version](https://img.shields.io/npm/v/@diplodoc/directive.svg?style=flat)](https://www.npmjs.org/package/@diplodoc/directive)

This is a pluggable parser for directive syntax for markdown markup. With it you can easily add implementation for a new block in you markdown project.

## Quickstart

Add new MarkdownIt-plugin or transformer extension, that plug-in a directive parser and register handler for new `block` directive:

```ts
import type MarkdownIt from 'markdown-it';
import {directiveParser, registerContainerDirective} from '@diplodoc/directive';

export function simpleBlockPlugin(): MarkdownIt.PluginSimple {
  return (md) => {
    md.use(directiveParser());

    // register container directive using handler
    registerContainerDirective(md, 'block', (state, params) => {
      if (!params.content) return false;

      let token = state.push('simple_block_open', 'div', 1);
      token.attrSet('class', 'simple-block');

      tokenizeBlockContent(state, params.content);

      token = state.push('simple_block_close', 'div', -1);

      return true;
    });

    // or using config-object
    registerContainerDirective(md, {
      name: 'block',
      match(_params, state) {
        // here you can add something to state.env
        return true;
      },
      container: {
        tag: 'div',
        token: 'simple_block',
        attrs: {
          class: 'simple-block',
        },
      },
    });
  };
}
```

Then attach this plugin/extension to transformer or markdown-it instance:

```ts
import transform from '@diplodoc/transform';

const markup = `
::: block
### Heading 3 inside a simple block
:::
`;

const {result: {html}} = await transform(markup, plugins: [
    simpleBlockPlugin(),
]);

// or

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt().use(simpleBlockPlugin());

const html = md.render(markup);
```

`html` variable will have the value:

```html
<div class="simple-block">
  <h3>Heading 3 inside a simple block</h3>
</div>
```

## Directive syntax

Supported inline and block directive syntax. Inline directives are found in the text and start with `:`. Block directive is may be leaf block (without content, start with `::`) and container block (with content, start with `:::`).

- Inline: `:name [content] (identifier) {key=value}`
- Leaf block: `::name [inline content] (identifier) {key=value}`
- Container block:
  ```
  :::name [inline content] (identifier) {key=value}
  content
  :::
  ```

All of parameters groups – `[]`, `()`, `{}` – are optional, but their order is fixed.

- `[]` – used for something like inline-content;
- `()` – used for something like required identifier (id, url, etc.);
- `{}` – used to pass optional named arguments / attributes / `key=value` pairs.

## Helpers

### Enable or disable some of directive types

- `enableInlineDirectives(md: MarkdownIt): void` – enable parsing of inline directives;

- `disableInlineDirectives(md: MarkdownIt): void` – disable parsing of inline directives;

- `enableBlockDirectives(md: MarkdownIt): void` – enable parsing of leaf and container blocks directives;

- `disableBlockDirectives(md: MarkdownIt): void` – disable parsing of leaf and container blocks directives.

### Register directive handler

- `registerInlineDirective()` – register handler for new inline directive. Name of directive used in markdown markup after `:`, for example: `:dir`.

  ```ts
  function registerInlineDirective(
    md: MarkdownIt,
    name: string,
    handler: InlineDirectiveHandler,
  ): void;
  ```

- `registerLeafBlockDirective()` – register handler for new leaf block directive.

  ```ts
  function registerLeafBlockDirective(md: MarkdownIt, config: LeafBlockDirectiveConfig): void;
  function registerLeafBlockDirective(
    md: MarkdownIt,
    name: string,
    handler: LeafBlockDirectiveHandler,
  ): void;
  ```

- `registerContainerDirective()` – register handler for new container block or configure it using config-object.
  ```ts
  function registerContainerDirective(
    md: MarkdownIt,
    config: ContainerDirectiveConfig | CodeContainerDirectiveConfig,
  ): void;
  function registerContainerDirective(
    md: MarkdownIt,
    name: string,
    handler: ContainerDirectiveHandler,
  ): void;
  ```

### Tokenizers

- `tokenizeInlineContent()` – can be used inside inline directive handler for parse and tokenize content of `[]`-section.

  ```ts
  function tokenizeInlineContent(
    state: MarkdownIt['inline']['State'],
    content: InlineContent,
  ): void;
  ```

- `tokenizeBlockContent()` – can be used inside block directive handler for parse and tokenize content between opening `:::name` and closing `:::` markup of container block directive.

  ```ts
  function tokenizeBlockContent(state: MarkdownIt['block']['State'], content: BlockContent): void;
  ```

- `createBlockInlineToken()` – can be used inside block directive handler for creating token with inline content of `[]`-section.

  ```ts
  function createBlockInlineToken(
    state: MarkdownIt['block']['State'],
    params: BlockDirectiveParams,
  ): MarkdownIt.Token;
  ```
