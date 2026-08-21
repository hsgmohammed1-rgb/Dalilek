import sys, os, re
sys.stdout.reconfigure(encoding='utf-8')

with open('C:\\Users\\MOH\\Documents\\GG\\Dalilek-master\\assets\\index-CdSb2jcH.v3.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find social media related keys in translations
# Look at what's around the newsletter section in NI
idx = content.find('function NI(')
end_ni = content.find('const _I=', idx)
ni_func = content[idx:end_ni]

# Check what translation keys are available in the newsletter/contact sections
# Find e.newsletter or similar
newsletter_idx = content.find('e.newsletter')
if newsletter_idx >= 0:
    context = content[newsletter_idx-100:newsletter_idx+300]
    keys = set(re.findall(r'e\.(\w+)', context))
    print('Newsletter context keys:', sorted(keys))

# Find e.social or similar
social_idx = content.find('e.social')
if social_idx >= 0:
    print('Found e.social at', social_idx)
else:
    print('No e.social found')

# Check what translations exist for social in the entire file
all_keys = set(re.findall(r'e\.([a-zA-Z]\w*)', content))
social_keys = [k for k in all_keys if 'social' in k.lower() or 'follow' in k.lower()]
print('Social-related keys:', social_keys)

# Let me look at the translation object structure
# Find the translation data - probably defined as a large object
trans_idx = content.find('"ar":{')
if trans_idx >= 0:
    # Find newsletter block
    ns_idx = content.find('"newsletter"', trans_idx)
    if ns_idx >= 0:
        ns_block = content[ns_idx:ns_idx+800]
        keys_in_ns = re.findall(r'"(\w+)":', ns_block)
        print('Newsletter translation keys:', keys_in_ns)

    # Find social block  
    sc_idx = content.find('"social"', trans_idx)
    if sc_idx >= 0:
        sc_block = content[sc_idx:sc_idx+800]
        keys_in_sc = re.findall(r'"(\w+)":', sc_block)
        print('Social translation keys:', keys_in_sc)
    else:
        print('No social translation block found')

# Find where the social section should go in NI
# Find the exact pattern around fI and Gt
pattern = re.search(r'i\.jsx\(fI,\{\}\)\]\}\)\,i\.jsx\(Gt,\{\}\)', ni_func)
if pattern:
    print('Found exact insertion point')
    print('Before:', ni_func[pattern.start()-50:pattern.start()])
    print('Pattern:', pattern.group())
    print('After:', ni_func[pattern.end():pattern.end()+50])
else:
    print('Could not find exact pattern')
    # Try broader search
    fi_idx = ni_func.find('i.jsx(fI,{})')
    if fi_idx >= 0:
        print('fI found at offset', fi_idx, 'in NI')
        print('Context:', ni_func[fi_idx-30:fi_idx+80])
