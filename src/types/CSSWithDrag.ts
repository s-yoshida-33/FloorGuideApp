// src/types/CSSWithDrag.ts

import React from 'react';

export type CSSWithDrag = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};
