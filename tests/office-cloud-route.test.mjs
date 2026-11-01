import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpHarness,officeToken,initialization } from './office-mcp-harness.mjs';

test('real office routes connect a cloud agent through PKCE, preserve its seat, and revoke access without touching its original credential',async t=>{
  const h=mcpHarness(t),member=await h.apply();await h.approve(member);
  const base='https://office.example',resource=base+'/api/office/mcp';
  const metadata=await(await h.call('/api/office/oauth/metadata')).json();assert.equal(metadata.issuer,base+'/api/office/oauth');
  const protectedResource=await(await h.call('/api/office/oauth/resource')).json();assert.equal(protectedResource.resource,resource);
  const registered=await h.call('/api/office/oauth/register',{method:'POST',body:{client_name:'Cloud Agent',redirect_uris:['https://cloud.example/callback'],token_endpoint_auth_method:'none'}});assert.equal(registered.status,201);const client=await registered.json();
  const verifier='c'.repeat(64),challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
  const query=new URLSearchParams({client_id:client.client_id,response_type:'code',redirect_uri:'https://cloud.example/callback',code_challenge:challenge,code_challenge_method:'S256',scope:'office',resource,state:'opaque-cloud-state'});
  const authorize=await h.call('/api/office/oauth/authorize?'+query);assert.equal(authorize.status,302);
  const consentLocation=new URL(authorize.headers.get('Location'));assert.equal(consentLocation.pathname,'/office/connect/');assert.ok(!consentLocation.href.includes(member.token));
  const requestId=consentLocation.searchParams.get('request_id'),info=await(await h.call('/api/office/oauth/request?request_id='+requestId)).json();assert.equal(info.clientName,'Cloud Agent');
  const approved=await h.call('/api/office/oauth/consent',{method:'POST',origin:base,body:{requestId,csrfToken:info.csrfToken,officeToken:member.token,approve:true}});assert.equal(approved.status,200);
  const callback=new URL((await approved.json()).redirectUrl);assert.equal(callback.origin,'https://cloud.example');assert.equal(callback.searchParams.get('state'),'opaque-cloud-state');assert.ok(!callback.href.includes(member.token));
  const form=new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:'https://cloud.example/callback',code:callback.searchParams.get('code'),code_verifier:verifier,resource});
  const exchanged=await h.call('/api/office/oauth/token',{method:'POST',raw:form.toString(),extra:{'Content-Type':'application/x-www-form-urlencoded'}});assert.equal(exchanged.status,200);const tokens=await exchanged.json();assert.match(tokens.access_token,/^[a-f0-9]{64}$/);assert.notEqual(tokens.access_token,member.token);
  const connected=await h.tool('get_my_status',{},tokens.access_token);assert.equal(connected.status,200);const connectedData=await connected.json();assert.equal(connectedData.result.structuredContent.application.id,member.application.id);
  const connections=await(await h.call('/api/office/cloud-connections',{bearer:member.token})).json();assert.equal(connections.connections.length,1);assert.ok(!JSON.stringify(connections).includes(tokens.access_token));
  const reviewer=await h.login();assert.equal((await h.review(member.application.id,'revoked',reviewer)).status,200);assert.equal((await h.review(member.application.id,'approved',reviewer)).status,200);
  assert.equal((await h.mcp(initialization('2025-11-25'),tokens.access_token)).status,401,'Reapproval does not resurrect a previously revoked cloud grant');
  const disabled=await h.call('/api/office/cloud-connections',{method:'POST',origin:base,bearer:member.token,body:{grantId:connections.connections[0].id}});assert.equal(disabled.status,200);
  const rejected=await h.mcp(initialization('2025-11-25'),tokens.access_token);assert.equal(rejected.status,401);assert.match(rejected.headers.get('WWW-Authenticate'),/resource_metadata=/);
  assert.equal((await(await h.call('/api/office/me',{bearer:member.token})).json()).application.status,'approved');
});

test('OAuth token routes reject unbounded, wrong-content and duplicate forms before they can grant access',async t=>{
  const h=mcpHarness(t);await h.apply();
  assert.equal((await h.call('/api/office/oauth/token',{method:'POST',body:{grant_type:'authorization_code'}})).status,415);
  assert.equal((await h.call('/api/office/oauth/token',{method:'POST',raw:'x'.repeat(9000),extra:{'Content-Type':'application/x-www-form-urlencoded'}})).status,413);
  assert.equal((await h.call('/api/office/oauth/token',{method:'POST',raw:'client_id=a&client_id=b',extra:{'Content-Type':'application/x-www-form-urlencoded'}})).status,400);
});
