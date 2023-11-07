(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[931],{8695:function(e,r,t){Promise.resolve().then(t.bind(t,7755))},7755:function(e,r,t){"use strict";t.r(r),t.d(r,{default:function(){return Home}});var a=t(757);t(1702);var n=t(7726),s=t(2116),l=t(929),i=t(9691),o=t(3978),c=t.n(o);t(5599);var u=t(5528),m=t(126),d=t(9330),f=t(1180);function _getPrimaryKeyValue(e,r){let t={};for(let a of r)t[a]=e[a];return JSON.stringify(t)}function DataFrameColumnGroupHeader(e){let{name:r,primaryKeys:t,onPrimaryKeyChange:n}=e;return"index"===r?(0,a.jsx)(a.Fragment,{}):t.includes(r)?(0,a.jsxs)(u.k,{alignItems:"center",children:[(0,a.jsx)(m.xu,{flex:1,children:r}),(0,a.jsx)(d.J,{cursor:"pointer",as:f.ven,onClick:()=>{let e=t.filter(e=>e!==r);n(e)}})]}):(0,a.jsxs)(u.k,{alignItems:"center",children:[(0,a.jsx)(m.xu,{flex:1,children:r}),(0,a.jsx)(d.J,{cursor:"pointer",as:f.MhP,onClick:()=>{let e=[...t.filter(e=>"index"!==e),r];n(e)}})]})}function queryDiff(e,r,t,n){let s=[],l=[],i={},o={};if(!c().isEqual(e.schema.primaryKey,r.schema.primaryKey))throw Error("primary key mismatch! ".concat(e.schema.primaryKey," != ").concat(r.schema.primaryKey));0===t.length&&(t=e.schema.primaryKey),r.schema.fields.forEach(e=>{i[e.name]={},i[e.name].current=e}),e.schema.fields.forEach(e=>{i[e.name]||(i[e.name]={}),i[e.name].base=e}),Object.entries(i).forEach(e=>{let[r,{base:i,current:o}]=e;if(t.includes(r))l.push({key:"".concat(r),name:(0,a.jsx)(DataFrameColumnGroupHeader,{name:r,primaryKeys:t,onPrimaryKeyChange:n}),frozen:!0});else{if("index"===r)return;let cellClass=e=>{if(!c().isEqual(e["base__".concat(r)],e["current__".concat(r)]))return"diff-cell"};s.push({name:(0,a.jsx)(DataFrameColumnGroupHeader,{name:r,primaryKeys:t,onPrimaryKeyChange:n}),children:[{key:"base__".concat(r),name:"Base",cellClass},{key:"current__".concat(r),name:"Current",cellClass}]})}}),r.data.forEach(e=>{let r=_getPrimaryKeyValue(e,t);o[r]={},o[r].current=e}),e.data.forEach(e=>{let r=_getPrimaryKeyValue(e,t);o[r]||(o[r]={}),o[r].base=e});let u=Object.entries(o).map(e=>{let[r,{base:a,current:n}]=e,s=JSON.parse(r);return a&&Object.keys(a).forEach(e=>{t.includes(e)||(s["base__".concat(e)]=a[e])}),n&&Object.keys(n).forEach(e=>{t.includes(e)||(s["current__".concat(e)]=n[e])}),s});return{columns:[...l,...s],rows:u}}var h=t(2218);let y=h.env.NEXT_PUBLIC_API_URL||"";var p=t(1197),x=t(3695);let DiffViewDataGrid=e=>{let{loading:r,error:t,errorStep:n,columns:l,rows:i}=e;return r?(0,a.jsx)(a.Fragment,{children:"Loading..."}):t?(0,a.jsxs)(a.Fragment,{children:["Error while querying ",n," environment: ",t]}):0===l.length?(0,a.jsx)(a.Fragment,{children:"No data"}):(0,a.jsx)(s.ZP,{style:{height:"100%"},columns:l,rows:i,defaultColumnOptions:{resizable:!0}})};var components_DiffView=()=>{let[e,r]=(0,n.useState)('select * from {{ ref("mymodel") }} limit 1000'),[t,s]=(0,n.useState)(!1),[o,c]=(0,n.useState)(),[d,f]=(0,n.useState)(),[h,g]=(0,n.useState)(),[_,j]=(0,n.useState)(),[v,b]=(0,n.useState)([]),k=(0,n.useCallback)(async()=>{let r="current";try{s(!0);let t=await l.default.post("".concat(y,"/api/query"),{sql_template:e,base:!1});if(200!==t.status)throw Error("error");r="base";let a=await l.default.post("".concat(y,"/api/query"),{sql_template:e,base:!0});if(200!==a.status)throw Error("error");g(a.data),j(t.data),b([]),c(void 0),f(void 0)}catch(e){if(e instanceof i.d7){var t,a;let r=null==e?void 0:null===(a=e.response)||void 0===a?void 0:null===(t=a.data)||void 0===t?void 0:t.detail;r?c(r):c(null==e?void 0:e.message)}else c(null==e?void 0:e.message);f(r)}finally{s(!1)}},[e]),C=(0,n.useMemo)(()=>h&&_?queryDiff(h,_,v,e=>{b(e)}):{rows:[],columns:[]},[h,_,v]);return(0,a.jsxs)(u.k,{direction:"column",height:"100vh",children:[(0,a.jsx)(u.k,{justifyContent:"right",padding:"5px",children:(0,a.jsx)(p.z,{colorScheme:"blue",onClick:k,disabled:t,size:"sm",children:"Run"})}),(0,a.jsx)(x.g,{flex:"1",height:"200px",value:e,onChange:e=>r(e.target.value),onKeyDown:e=>{"Enter"===e.key&&(e.ctrlKey||e.metaKey)&&(k(),e.preventDefault())},placeholder:"Enter your SQL query here",rows:20,style:{width:"100%"}}),(0,a.jsx)(m.xu,{backgroundColor:"gray.100",height:"50vh",children:(0,a.jsx)(DiffViewDataGrid,{loading:t,error:o,errorStep:d,rows:C.rows,columns:C.columns})})]})};function Home(){return(0,a.jsx)(components_DiffView,{})}},5599:function(){}},function(e){e.O(0,[170,495,108,38,297,62,744],function(){return e(e.s=8695)}),_N_E=e.O()}]);