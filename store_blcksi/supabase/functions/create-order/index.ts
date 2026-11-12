import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const configuredOrigins=(Deno.env.get("ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean);
const localOrigins=["http://localhost:3000","http://localhost:5173","http://localhost:5500","http://127.0.0.1:5500"];
function corsHeaders(req:Request){
 const origin=req.headers.get("origin")||"";
 const allowed=configuredOrigins.includes(origin)||localOrigins.includes(origin);
 return {"Vary":"Origin",...(allowed?{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}:{})};
}
const json=(body:unknown,status=200,req?:Request)=>new Response(JSON.stringify(body),{status,headers:{...(req?corsHeaders(req):{}),"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders(req)});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405,req);
 try{
  const body=await req.json();const customer=body?.customer;const items=body?.items;
  if(!["M-Pesa","e-Mola","Transferência bancária"].includes(body?.payment_method))return json({error:"invalid_payment_method"},400,req);
  if(!customer||typeof customer.name!=="string"||customer.name.trim().length<2||customer.name.length>120||typeof customer.phone!=="string"||customer.phone.trim().length<7||customer.phone.length>30||typeof customer.address!=="string"||customer.address.trim().length<3||customer.address.length>240||!Array.isArray(items)||items.length<1||items.length>30)return json({error:"invalid_input"},400,req);
  const raw=items.map((x:any)=>({slug:String(x?.slug||"").trim().slice(0,100),quantity:Number(x?.quantity),size:x?.size?String(x.size).trim().slice(0,12):null}));
  if(raw.some(x=>!x.slug||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99))return json({error:"invalid_items"},400,req);
  // Consolidar linhas repetidas para impedir que o mesmo SKU contorne a validação de stock.
  const grouped=new Map<string,{slug:string;quantity:number;size:string|null}>();
  for(const item of raw){const k=item.slug+"\u0000"+(item.size||"");const prev=grouped.get(k);if(prev)prev.quantity+=item.quantity;else grouped.set(k,{...item});}
  const clean=[...grouped.values()];
  const totalsBySlug=new Map<string,number>();
  for(const item of clean)totalsBySlug.set(item.slug,(totalsBySlug.get(item.slug)||0)+item.quantity);
  if([...totalsBySlug.values()].some(q=>q>99))return json({error:"quantity_limit_exceeded"},400,req);
  const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db=createClient(url,key,{auth:{persistSession:false}});
  const slugs=[...new Set(clean.map(x=>x.slug))];
  const {data:products,error}=await db.from("products").select("id,name,slug,price,stock,is_active").in("slug",slugs);
  if(error)throw error;
  const bySlug=new Map((products||[]).map(p=>[p.slug,p]));let subtotal=0;const rows=[];
  for(const [slug,quantity] of totalsBySlug){const p=bySlug.get(slug);if(!p||!p.is_active)return json({error:"product_unavailable",slug},409,req);if(Number(p.stock)<quantity)return json({error:"insufficient_stock",slug},409,req);}
  for(const item of clean){const p=bySlug.get(item.slug);const price=Number(p.price);if(!Number.isFinite(price)||price<0)return json({error:"invalid_product_price"},409,req);const line=Math.round(price*item.quantity*100)/100;subtotal+=line;rows.push({product_id:p.id,product_name:p.name,product_slug:p.slug,size:item.size,quantity:item.quantity,unit_price:price,line_total:line});}
  const orderNumber=`BLK-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const {data:order,error:orderError}=await db.from("orders").insert({order_number:orderNumber,customer_name:customer.name.trim(),customer_phone:customer.phone.trim(),delivery_address:customer.address.trim(),notes:String(body.notes||"").slice(0,500),subtotal,total:subtotal,status:"pending_payment",payment_method:body.payment_method}).select("id,order_number,total,status").single();
  if(orderError)throw orderError;
  const {error:itemError}=await db.from("order_items").insert(rows.map(r=>({...r,order_id:order.id})));
  if(itemError){await db.from("orders").delete().eq("id",order.id);throw itemError;}
  return json({order_number:order.order_number,total:order.total,status:order.status},200,req);
 }catch(e){console.error(e);return json({error:"order_creation_failed"},500,req)}
});
