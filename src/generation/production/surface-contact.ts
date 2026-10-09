import type{StructuralVolume,Vec3}from'../../blueprint/types';
import{profileRing,stationAt}from'../hull';
/** Production contact queries clamp an epsilon beyond the last station to the actual
 * aft ring. The historical station lookup remains unchanged for frozen generation fixtures. */
export function containsProductionVolume(volume:StructuralVolume,p:Vec3,tolerance=0){
 const stations=volume.geometry.stations,z=p.z-volume.position.z,first=stations[0].z,last=stations.at(-1)!.z;
 if(z<first-tolerance||z>last+tolerance)return false;
 const ring=profileRing(stationAt(stations,Math.max(first,Math.min(last,z)))),x=p.x-volume.position.x,y=p.y-volume.position.y;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],cross=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(cross>tolerance*Math.hypot(b[0]-a[0],b[1]-a[1]))return false;}
 return true;
}
