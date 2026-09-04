import React,{lazy} from 'react';
import type {RouteObject} from 'react-router-dom';
const List=lazy(()=>import('./list.tsx'));const Detail=lazy(()=>import('./detail.tsx'));
export const ApplicationsRoutes:readonly RouteObject[]=[{path:'applications',element:<List/>},{path:'applications/detail',element:<Detail/>}];
