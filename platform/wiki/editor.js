import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import {TableKit} from '@tiptap/extension-table';
import {Markdown} from '@tiptap/markdown';
import DOMPurify from 'dompurify';

// Imported documents contain literal "1." / "-" paragraph prefixes. Keep
// them as text instead of accidentally turning them into Markdown lists.
const WikiParagraph=Paragraph.extend({
 renderMarkdown(node,h,ctx){
  const content=Array.isArray(node?.content)?node.content:[];
  if(!content.length)return ctx?.previousNode?.type==='paragraph'&&!ctx.previousNode.content?.length?'&nbsp;':'';
  return h.renderChildren(content).replace(/^( {0,3})(\d+)([.)])(?=\s)/gm,'$1$2\\$3').replace(/^( {0,3})([-+>])(?=\s)/gm,'$1\\$2').replace(/^( {0,3})(#{1,6})(?=\s)/gm,'$1\\$2');
 }
});

export function wikiEditor({element,html,onUpdate,onSelection=()=>{},onBlur=()=>{}}){
 return new Editor({
  element,content:html,
  extensions:[StarterKit.configure({paragraph:false,underline:false,link:{openOnClick:false,autolink:false,HTMLAttributes:{target:'_blank',rel:'noopener noreferrer'}}}),WikiParagraph,TableKit.configure({table:{resizable:false}}),Markdown],
  editorProps:{attributes:{role:'textbox','aria-label':'Текст раздела','aria-multiline':'true',spellcheck:'true'},transformPastedHTML:html=>DOMPurify.sanitize(html)},
  onUpdate:({editor})=>onUpdate(editor.getMarkdown()),
  onSelectionUpdate:({editor})=>onSelection(editor),onFocus:({editor})=>onSelection(editor),onBlur
 });
}
