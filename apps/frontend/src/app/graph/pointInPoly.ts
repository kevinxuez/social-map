export function pointInPoly(pt:[number,number], poly:[number,number][]) {
  // ray casting
  let inside = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const xi=poly[i][0], yi=poly[i][1];
    const xj=poly[j][0], yj=poly[j][1];
    const intersect = ((yi>pt[1]) !== (yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi+0.0000001)+xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
