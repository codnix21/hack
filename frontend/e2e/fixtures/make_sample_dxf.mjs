/** Генерирует sample_warehouse.dxf с известной геометрией (мм). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(dir, 'sample_warehouse.dxf')

// Минимальный ASCII DXF: контур 10000×8000 мм и прямоугольник стеллажа 3000×2000
const content = `  0
SECTION
  2
HEADER
  9
$INSUNITS
 70
     4
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
LINE
  8
WALLS
 10
0.0
 20
0.0
 11
10000.0
 21
0.0
  0
LINE
  8
WALLS
 10
10000.0
 20
0.0
 11
10000.0
 21
8000.0
  0
LINE
  8
WALLS
 10
10000.0
 20
8000.0
 11
0.0
 21
8000.0
  0
LINE
  8
WALLS
 10
0.0
 20
8000.0
 11
0.0
 21
0.0
  0
LWPOLYLINE
  8
RACKS
 90
        4
 70
     1
 10
2000.0
 20
2000.0
 10
5000.0
 20
2000.0
 10
5000.0
 20
4000.0
 10
2000.0
 20
4000.0
  0
ENDSEC
  0
EOF
`

fs.writeFileSync(out, content, 'utf8')
console.log('wrote', out)
