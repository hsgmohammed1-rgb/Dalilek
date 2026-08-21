import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('C:\\Users\\MOH\\Documents\\GG\\Dalilek-master\\assets\\index-CdSb2jcH.v3.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find social section area
idx = content.find('تابعنا على')
if idx >= 0:
    # Get the social section plus surrounding context
    start = content.rfind('i.jsxs', idx-500, idx)
    # Find where main ends and Gt starts
    gt_idx = content.find('i.jsx(Gt,{})', idx)
    snippet = content[start:gt_idx+50]
    # Count i.jsx and i.jsxs openings
    opens_jsx = snippet.count('i.jsx(') - snippet.count('i.jsxs(')  # count non-jsxs
    opens_jsxs = snippet.count('i.jsxs(')
    total_opens = opens_jsx + opens_jsxs
    # Count closings: ) and } and ]
    closes_paren = snippet.count(')')
    closes_brace = snippet.count('}')
    closes_bracket = snippet.count(']')
    print(f'Total i.jsx() opens: {opens_jsx}')
    print(f'Total i.jsxs() opens: {opens_jsxs}')
    print(f'Total opens: {total_opens}')
    print(f') count: {closes_paren}')
    print('} count: ' + str(closes_brace))
    print(f'] count: {closes_bracket}')
    # Between the last link and Gt
    last_link = snippet.rfind('LinkedIn')
    after = snippet[last_link:last_link+100]
    print(f'After last link: {repr(after)}')
else:
    print('تابعنا على not found')
