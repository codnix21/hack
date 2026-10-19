import io
from pathlib import Path

import ezdxf

doc = ezdxf.new("R2010")
doc.header["$INSUNITS"] = 4  # mm
msp = doc.modelspace()
for a, b in [
    ((0, 0), (10000, 0)),
    ((10000, 0), (10000, 8000)),
    ((10000, 8000), (0, 8000)),
    ((0, 8000), (0, 0)),
]:
    msp.add_line(a, b, dxfattribs={"layer": "WALLS"})
msp.add_lwpolyline(
    [(2000, 2000), (5000, 2000), (5000, 4000), (2000, 4000)],
    close=True,
    dxfattribs={"layer": "RACKS"},
)
buf = io.StringIO()
doc.write(buf)
out = Path(__file__).with_name("sample_warehouse.dxf")
out.write_text(buf.getvalue(), encoding="utf-8")
print(out, out.stat().st_size)
