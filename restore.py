import sys
sys.stdout.reconfigure(encoding='utf-8')

fpath = 'C:\\Users\\MOH\\Documents\\GG\\Dalilek-master\\assets\\index-CdSb2jcH.v3.js'
with open(fpath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find what's between fI and Gt
fi_idx = content.find('i.jsx(fI,{})')
gt_idx = content.find('i.jsx(Gt,{})', fi_idx)

if fi_idx >= 0 and gt_idx >= 0:
    between = content[fi_idx:gt_idx]
    print("Between fI and Gt length:", len(between))
    print("First 60 chars:", repr(between[:60]))
    print("Last 60 chars:", repr(between[-60:]))
    
    # Check if there's extra content between fI and Gt
    expected = 'i.jsx(fI,{})'
    if between != expected:
        # Restore by replacing everything between fi_idx and gt_idx
        new_content = content[:fi_idx] + expected + content[gt_idx:]
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Restored: removed extra content between fI and Gt")
    else:
        print("Already clean")
else:
    print("Could not find fI or Gt")
