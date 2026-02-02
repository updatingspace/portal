# @diplodoc/color-extension

## install

```shell
npm install @diplodoc/color-extension --save
```

## use

```javascript
var md = require('markdown-it')()
            .use(require('@diplodoc/color-extension'))
```

## API

You can add options. Default option is below.

```javascript
const md = require('markdown-it')()
            .use(require('@diplodoc/color-extension'), {
              defaultClassName: 'yfm-colorify',
              inline: false, // default
            })

md.render('{primary}(sample)') // => '<span class="yfm-colorify yfm-colorify--primary">sample</span>'
```

If you want to use inline style, use like below.

```javascript
const md = require('markdown-it')()
            .use(require('@diplodoc/color-extension'), {
              inline: true,
            })

md.render('{red}(sample)') // => '<span class="yfm-colorify yfm-colorify--red" style="color: red;">sample</span>'
```
