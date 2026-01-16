// @flow
declare var L: any;
declare var supabase: any;
declare var Chart: any;
declare var jspdf: any;
// Fixes 'Cannot resolve name Image'
declare class Image extends HTMLElement { 
  src: string;
  onload: () => void;
  onerror: () => void;
  crossOrigin: string;
}