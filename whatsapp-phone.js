export function whatsappPhone(value,mode='mx'){
 const digits=String(value||'').trim().replace(/[\s()+.-]/g,'');
 if(!/^\d+$/.test(digits))throw new Error('Escribe solo el teléfono, sin letras ni extensiones.');
 if(mode==='mx'){
  if(/^\d{10}$/.test(digits))return '52'+digits;
  if(/^52\d{10}$/.test(digits))return digits;
  throw new Error('Para México escribe 10 dígitos, o +52 seguido de los 10 dígitos.');
 }
 if(!/^[1-9]\d{7,14}$/.test(digits))throw new Error('Escribe el número internacional completo, incluido el código de país (8 a 15 dígitos).');
 return digits;
}
