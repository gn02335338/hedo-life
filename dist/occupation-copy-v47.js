import {displayText as displayPersonaText} from './persona.js';

// Occupation labels are a presentation concern. Keep the design role ID,
// historical titles and server-validated replay text in their published form.
// Protect links, file paths and stable identifiers before applying either
// occupation wording or the current character aliases.
const PROTECTED_TEXT_V47=/((?:https?:\/\/|\.{1,2}\/)[^\s<>"'，。；）]+|(?<![\p{L}\p{N}_])\/[^\s<>"'，。；）]+|[A-Za-z0-9_-]+[_-](?:產品)?設計(?:師|副理|經理|總監|主管|長)[A-Za-z0-9_-]*|(?:產品)?設計(?:師|副理|經理|總監|主管|長)[_-][A-Za-z0-9_-]+|[A-Za-z0-9_-]*(?:產品)?設計(?:師|副理|經理|總監|主管|長)\.[A-Za-z0-9]{1,8})/gu;

export function displayOccupationTextV47(value=''){
 return String(value).split(PROTECTED_TEXT_V47).map((part,index)=>index%2?part:displayPersonaText(part)
  .replace(/(?:產品)?設計師/g,'產品設計')
  .replace(/(?<!產品)設計(?=副理|經理|總監|主管|長)/g,'產品設計')).join('');
}
