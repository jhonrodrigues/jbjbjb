import { createHmac } from "node:crypto";
import { describe,expect,it } from "vitest";
import { isValidMetaSignature,parseMetaWhatsAppInbound } from "@/lib/meta-whatsapp";
import { safeMarketingKey } from "@/lib/acquisition";

const payload={
  object:"whatsapp_business_account",
  entry:[{changes:[{field:"messages",value:{
    metadata:{phone_number_id:"12345"},contacts:[{wa_id:"5511999999999",profile:{name:"Cliente Teste"}}],
    messages:[{from:"5511999999999",id:"wamid.example01",type:"text",
      text:{body:"Olá, quero conhecer o site."},
      referral:{source_type:"ad",source_id:"12345678"}}],
  }}]}],
};

describe("Cloud API — segurança e parsing",()=>{
  it("valida HMAC-SHA256 do body exato com segredo da Meta",()=>{
    const raw=JSON.stringify(payload),secret="meta-fake-secret";
    const signature="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
    expect(isValidMetaSignature(raw,signature,secret)).toBe(true);
    expect(isValidMetaSignature(raw+" ",signature,secret)).toBe(false);
    expect(isValidMetaSignature(raw,"sha256=invalid",secret)).toBe(false);
    expect(isValidMetaSignature(raw,null,secret)).toBe(false);
    expect(isValidMetaSignature(raw,signature,"wrong-secret")).toBe(false);
  });
  it("aceita somente evento text do número comercial configurado",()=>{
    const parsed=parseMetaWhatsAppInbound(payload,"12345");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      senderId:"5511999999999",displayName:"Cliente Teste",text:"Olá, quero conhecer o site.",
      providerMessageId:"wamid.example01",isAdReferral:true,adKey:"12345678",
    });
    expect(parseMetaWhatsAppInbound(payload,"outro-numero")).toEqual([]);
    expect(parseMetaWhatsAppInbound({object:"not_whatsapp",entry:payload.entry},"12345")).toEqual([]);
  });
  it("ignora status, mídia e payloads sem texto",()=>{
    const value={metadata:{phone_number_id:"12345"},messages:[
      {from:"5511999999999",id:"wamid.image",type:"image",image:{id:"1"}},
      {from:"5511999999999",id:"wamid.empty",type:"text",text:{body:""}},
    ]};
    const body={object:"whatsapp_business_account",entry:[{changes:[{field:"messages",value}]}]};
    expect(parseMetaWhatsAppInbound(body,"12345")).toEqual([]);
  });
  it("limita identificadores recebidos para atribuição sem injeção",()=>{
    expect(safeMarketingKey("ads-2026.campanha")).toBe("ads-2026.campanha");
    expect(safeMarketingKey("../../../password")).toBeNull();
    expect(safeMarketingKey("x".repeat(170))).toBeNull();
  });
});
