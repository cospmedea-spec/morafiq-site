const $=id=>document.getElementById(id), cfg=window.MF5_CONFIG||{};
const db=cfg.url&&cfg.anonKey&&window.supabase?supabase.createClient(cfg.url,cfg.anonKey):null;
const labels={activities:'أنشطة المستشارين',student_statistics:'إحصائيات التلاميذ',interview_statistics:'حصائل المقابلات',annual_programs:'البرامج السنوية',monthly_programs:'البرامج الشهرية',calendar_statistics:'المفكرة العامة',monthly_summaries:'الحصائل الشهرية',annual_summaries:'الحصائل السنوية'};
function say(s){$('message').textContent=s}
function busy(b,on){b.disabled=on;b.setAttribute('aria-busy',String(on))}
function option(value,label){const o=node('option',label);o.value=value;return o}
function validPeriod(v){return /^\d{4}-(0[1-9]|1[0-2])$/.test(v)}
function node(tag,txt){let x=document.createElement(tag);x.textContent=txt;return x}
async function rpc(name,args={}){if(!db)throw Error('ضع رابط Supabase والمفتاح العام في config.js');const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data}
async function auth(){if(!db)throw Error('إعداد Supabase غير مكتمل');const {data,error}=await db.auth.getUser();if(error||!data.user)throw Error('سجل الدخول أولًا');return data.user}
async function login(){try{if(!db)throw Error('إعداد Supabase غير مكتمل');let {error}=await db.auth.signInWithPassword({email:$('email').value,password:$('password').value});if(error)throw error;location.reload()}catch(e){say(e.message)}}
async function signup(){try{if(!db)throw Error('إعداد Supabase غير مكتمل');let {error}=await db.auth.signUp({email:$('email').value,password:$('password').value});if(error)throw error;say('تحقق من بريدك الإلكتروني ثم سجّل الدخول')}catch(e){say(e.message)}}
async function logout(){await db?.auth.signOut();location.reload()}
async function start(){try{const u=await auth();$('auth').hidden=true;$('workspace').hidden=false;$('who').textContent=u.email;await load()}catch(e){say(e.message)}}
function row(parent,values){const tr=document.createElement('tr');values.forEach(v=>tr.append(node('td',String(v??'—'))));parent.append(tr);return tr}
function button(label,fn){const b=node('button',label);b.onclick=async()=>{busy(b,true);try{await fn();say('تم تنفيذ العملية');await load()}catch(e){say(e.message)}finally{busy(b,false)}};return b}
async function load(){const role=await rpc('mf5_role');const expected=document.body.dataset.role;if(role.role==='unregistered'){if(expected==='admin'){ $('workspace').hidden=true;say('هذا الحساب ليس مسؤول موقع معتمدًا');return }$('register').hidden=false; $('workspace').hidden=false; $('identity').textContent='إكمال التسجيل'; return }if(role.role!==expected){$('workspace').hidden=true;say('هذا الحساب ليس من نوع '+expected+'؛ نوع الحساب الحالي: '+role.role);return} $('register').hidden=true;$('pending').hidden=true;$('identity').textContent=role.name?role.name+' — '+role.wilaya:({admin:'مسؤول الموقع',center:'مدير مركز التوجيه',counselor:'مستشار التوجيه'}[expected]);if(expected==='admin')await admin();if(expected==='center')await center(role);if(expected==='counselor')await counselor(role)}
async function chooseDistrict(centerId){
 const ds=await rpc('mf5_admin_districts',{p_center:centerId});
 if(!ds.length)throw Error('أضف مقاطعة إلى المركز أولًا');
 const panel=$('assignPanel'),select=$('assignDistrict');
 select.replaceChildren();ds.forEach(d=>select.append(option(d.id,d.name)));
 panel.hidden=false;
 return new Promise((resolve,reject)=>{
   const ok=$('confirmAssign'),cancel=$('cancelAssign');
   const finish=(value)=>{ok.onclick=null;cancel.onclick=null;panel.hidden=true;resolve(value)};
   ok.onclick=()=>finish(select.value);cancel.onclick=()=>finish(null);
 });
}
async function admin(){
 const centers=await rpc('mf5_admin_centers');const people=await rpc('mf5_admin_counselors');
 const list=$('centers');list.replaceChildren();
 for(const c of centers){let tr=row(list,[c.name,c.wilaya,c.status]);let td=node('td','');
 if(c.status!=='approved')td.append(button('اعتماد',()=>rpc('mf5_admin_approve',{p_id:c.id,p_approve:true})));
 if(c.status!=='rejected')td.append(button('رفض',()=>rpc('mf5_admin_approve',{p_id:c.id,p_approve:false})));
 tr.append(td)}
 const sel=$('centerSelect'),old=sel.value;sel.replaceChildren();
 for(const c of centers.filter(x=>x.status==='approved'))sel.append(option(c.id,c.name+' — '+c.wilaya));
 if([...sel.options].some(o=>o.value===old))sel.value=old;
 const body=$('counselors');body.replaceChildren();
 for(const p of people){let tr=row(body,[p.name,p.status,centers.find(c=>c.id===p.center_id)?.name||'غير مسند']);let td=node('td','');
 td.append(button('إسناد إلى المركز والمقاطعة',async()=>{
   const cid=sel.value;if(!cid)throw Error('اختر مركزًا معتمدًا');
   const district=await chooseDistrict(cid);if(!district)return;
   await rpc('mf5_admin_assign',{p_user:p.id,p_center:cid,p_district:district});
 }));tr.append(td)}
 $('addDistrict').onclick=async()=>{const b=$('addDistrict');busy(b,true);try{
 const name=$('district').value.trim();if(!sel.value||!name)throw Error('اختر المركز واكتب اسم المقاطعة');
 await rpc('mf5_admin_district',{p_center:sel.value,p_name:name});$('district').value='';say('أضيفت المقاطعة بنجاح')
 }catch(e){say(e.message)}finally{busy(b,false)}};
 $('grant').onclick=async()=>{const b=$('grant');busy(b,true);try{
 if(!sel.value)throw Error('اختر مركزًا معتمدًا');
 await rpc('mf5_admin_permission',{p_center:sel.value,p_feature:$('feature').value,p_enabled:$('enabled').checked});say('تم تحديث الصلاحية')
 }catch(e){say(e.message)}finally{busy(b,false)}};
}
async function center(role){if(role.status!=='approved'){$('pending').hidden=false;$('pending').textContent='طلب المركز: '+role.status;return} $('dashboard').hidden=false;const permissions=await rpc('mf5_my_permissions');const stats=await rpc('mf5_center_stats');$('permissions').replaceChildren();Object.entries(labels).forEach(([k,v])=>{if(permissions[k])$('permissions').append(node('li',v))});$('stats').replaceChildren();stats.forEach(s=>row($('stats'),[labels[s.feature]||s.feature,s.period,s.total,s.contributors]));if(!stats.length)say('لا توجد مجاميع معروضة بعد؛ يجب مساهمة ثلاثة مستشارين مختلفين في المجال والفترة نفسيهما')}
async function counselor(role){if(role.status!=='approved'){$('pending').hidden=false;$('pending').textContent='حالة اعتماد المستشار: '+role.status;return}$('dashboard').hidden=false;const a=await rpc('mf5_my_submissions');$('history').replaceChildren();a.forEach(s=>row($('history'),[labels[s.feature]||s.feature,s.period,s.count]));$('send').onclick=async()=>{const b=$('send');busy(b,true);try{const period=$('period').value.trim(),raw=$('count').value.trim(),count=Number(raw);if(!validPeriod(period))throw Error('اكتب الفترة بصيغة 2026-11');if(raw===''||!Number.isSafeInteger(count)||count<0)throw Error('أدخل عددًا صحيحًا غير سالب');await rpc('mf5_submit',{p_feature:$('feature').value,p_period:period,p_count:count,p_note:''});$('count').value='';say('تم إرسال الإحصائية');await load()}catch(e){say(e.message)}finally{busy(b,false)}}}
window.addEventListener('DOMContentLoaded',()=>{Object.entries(labels).forEach(([k,v])=>{const sel=$('feature');if(sel){const o=node('option',v);o.value=k;sel.append(o)}});$('login').onclick=login;const refresh=$('refresh');if(refresh)refresh.onclick=async()=>{busy(refresh,true);try{await load();say('تم تحديث البيانات')}catch(e){say(e.message)}finally{busy(refresh,false)}};$('signup').onclick=signup;$('logout').onclick=logout; $('registerBtn').onclick=async()=>{try{if(document.body.dataset.role==='center')await rpc('mf5_register_center',{p_name:$('regName').value,p_wilaya:$('regPlace').value});else if(document.body.dataset.role==='counselor')await rpc('mf5_register_counselor',{p_name:$('regName').value,p_workplace:$('regPlace').value});else throw Error('مسؤول الموقع يعيّن يدويًا من Supabase');say('تم إرسال طلب التسجيل');await load()}catch(e){say(e.message)}};start()});
