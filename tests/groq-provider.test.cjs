const {test}=require('node:test');
const assert=require('node:assert/strict');
const axios=require('axios');
const {Readable}=require('node:stream');
const {AIProviderService}=require('../dist/services/ai-provider.service');
for(const key of ['GEMINI_API_KEY','XAI_API_KEY','OPENAI_API_KEY','OPENROUTER_API_KEY','OLLAMA_BASE_URL'])delete process.env[key];
process.env.GROQ_API_KEY='test-only';
test('Groq text and chat requests preserve schema instructions and history',async()=>{
 const original=axios.post;const calls=[];
 axios.post=async(url,body,config)=>{calls.push({url,body,config});return {data:{choices:[{finish_reason:'stop',message:{content:'{"answer":42}'}}]}}};
 try{
 const service=new AIProviderService();const model=service.getModel({generationConfig:{responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{answer:{type:'NUMBER'}}}}});
 assert.equal((await model.generateContent('Calculate')).response.text(),'{"answer":42}');
 const history=[{role:'user',parts:[{text:'Remember 42'}]}];await model.startChat({history}).sendMessage('Recall');
 assert.equal(calls[0].url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(calls[0].body.model,'openai/gpt-oss-120b');assert.equal(calls[0].body.response_format.type,'json_object');
 assert.match(calls[0].body.messages.at(-1).content,/schema/);assert.equal(history[0].parts[0].text,'Remember 42');
 assert.equal(service.buildProviders(false,false,'x',{} )[0].name,'GROQ');assert.equal(service.buildProviders(true,false,[],{}).length,0);
 }finally{axios.post=original}
});
test('Groq streaming handles fragmented UTF8 and rejects incomplete/error streams',async()=>{
 const service=new AIProviderService();const bytes=Buffer.from('data: {"choices":[{"delta":{"content":"café"}}]}\n\ndata: [DONE]');
 const chunks=Array.from(bytes,b=>Buffer.from([b]));let answer='';for await(const chunk of service.parseSseStream(Readable.from(chunks)))answer+=chunk;assert.equal(answer,'café');
 for(const text of ['data: {"error":{"message":"secret"}}\n','data: {"choices":[{"delta":{"content":"partial"}}]}\n','data: {"choices":[{"finish_reason":"length"}]}\n']){
 await assert.rejects(async()=>{for await(const _ of service.parseSseStream(Readable.from([text]))){}},/interrupted/);
 }
});
test('Groq rejects empty completions and preserves safe quota/auth errors',async()=>{
 const original=axios.post;try{
 const model=new AIProviderService().getModel({});
 axios.post=async()=>({data:{choices:[]}});await assert.rejects(model.generateContent('x'),e=>e.statusCode===502);
 for(const [status,expected] of [[429,429],[401,503]]){axios.post=async()=>{throw {response:{status,data:{error:'private-provider-detail'}}}};await assert.rejects(model.generateContent('x'),e=>e.statusCode===expected&&!e.message.includes('private-provider-detail'));}
 }finally{axios.post=original}
});
