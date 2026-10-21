"""User-approved BSCLINIC notation: main count first, bracketed leads deferred.
Only missing, unresolved source counts are filled. Confirmed client edits win.
"""
import copy,re

def parse_count(key,value):
    if not isinstance(value,str):return None,None
    text=value.strip()
    for opening,closing in [('(',')'),('{','}'),('[',']')]:
        pair=re.fullmatch(r'(\d+)\s*'+re.escape(opening)+r'\s*(\d+)\s*'+re.escape(closing),text)
        if pair:return int(pair[1]),int(pair[2])
    # In the appointments column a lone [3] is the primary appointment count.
    lone=re.fullmatch(r'\[\s*(\d+)\s*\]',text)
    if key=='appointments' and lone:return int(lone[1]),None
    deferred=re.fullmatch(r'[-–—]\s*[({]\s*(\d+)\s*[)}]',text)
    if deferred:return None,int(deferred[1])
    return None,None  # Do not turn negative counts into positive ones.

def resolve_row(row):
    result=copy.deepcopy(row)
    for key in ['appointments','patients']:
        raw=result.get('unconfirmed',{}).get(key) or result.get('sourceAnnotations',{}).get(key)
        main,deferred=parse_count(key,raw)
        if main is not None and result.get(key) is None and key in result.get('unconfirmed',{}):
            result[key]=main;result.setdefault('sourceAnnotations',{})[key]=raw;result['unconfirmed'].pop(key)
        if deferred is not None and 'deferredLeads' not in result:
            result['deferredLeads']=deferred;result.setdefault('sourceAnnotations',{})[key]=raw
    return result
