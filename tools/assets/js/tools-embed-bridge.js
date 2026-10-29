/* Same-origin embedding bridge. The legacy calculation engines are untouched. */
(function(){
 if(new URLSearchParams(window.location.search).get("embedded")!=="1")return;
 document.documentElement.classList.add("oc-embedded");
 var lastHeight=0,queued=false;
 function reportHeight(){
  if(queued)return;
  queued=true;
  window.requestAnimationFrame(function(){
   queued=false;
   var height=Math.ceil(Math.max(document.body.scrollHeight,document.documentElement.scrollHeight));
   if(Math.abs(height-lastHeight)>2){
    lastHeight=height;
    window.parent.postMessage({type:"oc:embedded-height",height:height},window.location.origin);
   }
  });
 }
 function init(){
  if("ResizeObserver" in window){new ResizeObserver(reportHeight).observe(document.body);}
  new MutationObserver(reportHeight).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style"]});
  document.querySelectorAll(".tool-tab").forEach(function(button){
   button.addEventListener("click",function(){
    window.parent.postMessage({type:"oc:tool-selected",tool:button.getAttribute("data-tool")},window.location.origin);
    reportHeight();
   });
  });
  window.parent.postMessage({type:"oc:embedded-ready"},window.location.origin);
  reportHeight();
 }
 window.addEventListener("message",function(event){
  if(event.origin!==window.location.origin||!event.data||event.data.type!=="oc:select-tool")return;
  document.querySelectorAll(".tool-tab").forEach(function(button){
   if(button.getAttribute("data-tool")===event.data.tool)button.click();
  });
 });
 window.addEventListener("load",reportHeight);
 window.addEventListener("resize",reportHeight);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
