import csv
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

CATEGORY_WORDS = {
    'core_survival': [
        'yes','no','please','thanks','sorry','hello','goodbye','help','stop','wait',
        'now','today','tomorrow','yesterday','here','there','more','less','enough','again',
        'name','address','phone','number','message','open','closed','ready','okay','important',
        'left','inside','outside','entry','exit','near','far','maybe','sure','someone',
        'everyone','something','nothing','anything','everything','always','never','soon','later','after'
    ],
    'question_words': [
        'who','what','when','where','why','how','which','whose','can','could',
        'would','should','may','if','because','answer','question','explain','repeat','spell',
        'mean','example','difference','choose','compare','describe','list','option','reason','problem',
        'correct','wrong','possible','impossible','exact','clear','unclear','similar','same','another',
        'else','either','neither','both','each','every','any','understand','show','tell'
    ],
    'numbers_quantity': [
        'zero','one','two','three','four','five','six','seven','eight','nine',
        'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen',
        'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','hundred','thousand',
        'first','second','third','fourth','fifth','many','few','some','all','none',
        'most','other','extra','half','full','empty','single','double','pair','total'
    ],
    'time_calendar': [
        'time','day','week','month','year','morning','afternoon','evening','night','noon',
        'midnight','minute','hour','second','monday','tuesday','wednesday','thursday','friday','saturday',
        'sunday','january','february','march','april','may','june','july','august','september',
        'october','november','december','weekend','holiday','birthday','spring','summer','autumn','winter',
        'early','late','before','during','until','schedule','calendar','date','season','future'
    ],
    'people_family': [
        'person','man','woman','child','baby','boy','girl','mother','father','parent',
        'son','daughter','brother','sister','husband','wife','friend','neighbor','teacher','doctor',
        'driver','waiter','customer','police','visitor','guest','couple','family','adult','teenager',
        'student','boss','worker','chef','nurse','manager','colleague','partner','uncle','aunt',
        'cousin','grandmother','grandfather','grandchild','roommate','owner','seller','buyer','guide','stranger'
    ],
    'directions_places': [
        'place','street','road','avenue','corner','center','north','south','east','west',
        'straight','across','around','between','behind','front','town','city','village','country',
        'airport','hotel','restaurant','hospital','pharmacy','bank','market','store','school','office',
        'park','beach','square','bridge','church','museum','station','library','building','neighborhood',
        'entrance','crosswalk','traffic','signal','stairs','elevator','floor','room','desk','counter'
    ],
    'transport_travel': [
        'bus','train','taxi','subway','tram','car','bicycle','scooter','motorcycle','plane',
        'flight','ticket','passport','luggage','bag','suitcase','map','route','trip','travel',
        'journey','stopover','platform','seat','driver','border','booking','rental','arrival','departure',
        'gate','terminal','checkin','delay','transfer','local','express','tour','reservation','hostel',
        'cab','ferry','cruise','trafficjam','compartment','aisle','windowseat','customs','boarding','departuregate'
    ],
    'food_drinks_dining': [
        'bread','rice','pasta','meat','chicken','beef','fish','egg','cheese','butter',
        'oil','salt','sugar','soup','salad','fruit','vegetable','apple','banana','orange',
        'lemon','tomato','potato','onion','garlic','pepper','carrot','milk','water','coffee',
        'tea','juice','beer','wine','menu','table','plate','bowl','spoon','fork',
        'knife','glass','cup','napkin','breakfast','lunch','dinner','dessert','bill','snack'
    ],
    'shopping_money': [
        'money','cash','card','coin','wallet','price','cost','change','discount','receipt',
        'shop','size','color','buy','sell','pay','return','refund','cashier','product',
        'brand','model','gift','sale','amount','tax','euro','cent','payment','invoice',
        'available','stock','online','delivery','pickup','package','quality','warranty','new','used',
        'medium','fitting','queue','basket','mall','checkout','coupon','barcode','exchange','purchase'
    ],
    'clothing_personal_items': [
        'shirt','pants','dress','shoes','hat','jacket','socks','skirt','sweater','tie',
        'coat','jeans','shorts','belt','gloves','scarf','boots','sandals','sneakers','underwear',
        'pajamas','uniform','pocket','button','zipper','necklace','ring','watch','bracelet','earrings',
        'backpack','purse','umbrella','sunglasses','glasses','cap','helmet','mask','suit','blouse',
        'wallet','laptopbag','passportcase','swimsuit','fabric','cotton','leather','hoodie','vest','slippers'
    ],
    'home_household': [
        'home','house','apartment','kitchen','bedroom','bathroom','livingroom','door','window','wall',
        'floor','ceiling','key','lock','bed','sofa','lamp','light','chair','blanket',
        'pillow','sheet','closet','drawer','shelf','fridge','freezer','oven','stove','sink',
        'mirror','laundry','detergent','trash','garden','balcony','roof','bell','internet','fan',
        'heater','airconditioner','remote','curtain','garage','basement','attic','plug','socket','hallway'
    ],
    'bathroom_hygiene': [
        'soap','shampoo','toothbrush','toothpaste','towel','shower','toiletpaper','sink','mirror','comb',
        'brush','razor','cream','lotion','deodorant','tissue','diaper','wipes','clean','dirty',
        'wash','dry','perfume','cologne','nail','hair','face','mouth','teeth','skin',
        'hand','foot','ear','eye','nose','lip','beard','makeup','sunscreen','sanitizer',
        'floss','bath','conditioner','shavingfoam','moisturizer','soapbar','toiletseat','tap','toiletry','tweezers'
    ],
    'body_health': [
        'head','arm','leg','finger','toe','back','neck','shoulder','chest','stomach',
        'heart','blood','bone','muscle','tooth','tongue','fever','pain','cough','virus',
        'flu','allergy','wound','bandage','clinic','medicine','prescription','appointment','pregnant','tired',
        'sick','healthy','breathe','exercise','headache','stomachache','dizzy','vomit','nausea','swelling',
        'injury','operation','hospitalbed','tablet','syrup','vitamin','checkup','pulse','temperature','cramp'
    ],
    'emergency_safety': [
        'danger','police','fire','ambulance','accident','emergency','safe','unsafe','lost','stolen',
        'broken','urgent','warning','alarm','report','document','visa','embassy','consulate','rescue',
        'flood','storm','earthquake','theft','robbery','attack','crisis','shelter','flashlight','battery',
        'charger','whistle','roadblock','closure','caution','trust','protect','escape','crowd','firefighter',
        'checkpoint','injured','smoke','burn','faint','panic','threat','guard','victim','beacon'
    ],
    'common_verbs_1': [
        'be','have','do','go','come','eat','drink','sleep','work','study',
        'live','stay','need','want','like','love','know','think','see','hear',
        'speak','say','ask','answer','give','take','buy','pay','start','finish',
        'sit','stand','walk','run','look','listen','read','write','bring','send',
        'call','meet','find','use','keep','hold','arrive','depart','cross','observe'
    ],
    'common_verbs_2': [
        'drive','ride','fly','reserve','check','enter','leave','lose','learn','teach',
        'remember','forget','receive','wash','clean','cook','cut','change','move','visit',
        'follow','return','plan','carry','wear','build','share','travel','decide','enjoy',
        'relax','smile','laugh','dance','play','swim','climb','borrow','discuss','confirm',
        'practice','order','charge','download','upload','sign','translate','describe','compare','repair'
    ],
    'adjectives_colors': [
        'big','small','long','short','old','young','different','easy','difficult','slow',
        'fast','hot','cold','busy','free','quiet','loud','good','bad','rich',
        'poor','cheap','expensive','heavy','light','strong','weak','happy','sad','angry',
        'excited','bored','worried','hungry','thirsty','red','blue','green','yellow','black',
        'white','pink','purple','orange','brown','gray','dark','bright','soft','hard'
    ],
    'weather_nature': [
        'sun','rain','wind','cloud','sky','sea','river','lake','mountain','tree',
        'flower','grass','leaf','stone','sand','snow','thunder','lightning','fog','air',
        'weather','temperature','shadow','star','moon','forest','field','island','valley','hill',
        'path','earth','ice','sunrise','sunset','wave','desert','jungle','stormy','sunny',
        'cloudy','windy','rainy','snowy','warm','cool','dry','wet','nature','rainbow'
    ],
    'work_study_technology': [
        'job','office','university','class','lesson','book','pen','pencil','paper','notebook',
        'computer','phone','email','website','password','file','folder','screen','keyboard','mouse',
        'app','camera','schedule','meeting','project','task','homework','exam','notes','printer',
        'document','factory','engineer','science','history','language','wifi','browser','headphones','microphone',
        'tablet','software','hardware','update','login','logout','calculator','speaker','charger','network'
    ],
    'social_leisure': [
        'music','movie','song','game','sport','team','party','photo','picture','dance',
        'art','reading','writing','drawing','painting','guitar','piano','picnic','concert','theater',
        'hobby','fun','chat','date','festival','vacation','football','tennis','swimming','cycling',
        'hiking','photography','series','podcast','friendship','celebration','wedding','birthday','weekend','museum',
        'library','camping','yoga','karaoke','laughter','smile','performance','ticketstub','picnicbasket','fireworks'
    ]
}

CATEGORY_ORDER = {name: i + 1 for i, name in enumerate(CATEGORY_WORDS.keys())}


def beginner_phrase(category: str, word: str) -> str:
    if category == 'core_survival':
        phrases = {
            'yes': 'Yes, please.', 'no': 'No, thank you.', 'please': 'Please help me.', 'thanks': 'Thanks for your help.',
            'sorry': 'Sorry, I am late.', 'hello': 'Hello, how are you?', 'goodbye': 'Goodbye, see you soon.',
            'help': 'I need help now.', 'stop': 'Please stop now.', 'wait': 'Please wait here.',
            'now': 'I need it now.', 'today': 'I arrive today.', 'tomorrow': 'See you tomorrow.',
            'yesterday': 'I left yesterday.', 'here': 'Wait for me here.', 'there': 'The station is there.',
            'more': 'I need more water.', 'less': 'I need less sugar.', 'enough': 'That is enough now.',
            'again': 'Please say it again.', 'name': 'What is your name?', 'address': 'What is your address?',
            'phone': 'My phone is here.', 'number': 'What number is it?', 'message': 'I sent a message.',
            'open': 'The store is open.', 'closed': 'The bank is closed.', 'ready': 'I am ready now.',
            'okay': 'Okay, let us go.', 'important': 'This is important.', 'left': 'Turn left here.',
            'inside': 'Please come inside.', 'outside': 'Wait for me outside.', 'entry': 'Where is the entry?',
            'exit': 'Where is the exit?', 'near': 'The hotel is near.', 'far': 'The beach is far.',
            'maybe': 'Maybe later today.', 'sure': 'I am sure.', 'someone': 'Someone is waiting outside.',
            'everyone': 'Everyone is here.', 'something': 'I need something else.', 'nothing': 'I need nothing else.',
            'anything': 'Do you need anything?', 'everything': 'Everything is ready.', 'always': 'I always come early.',
            'never': 'I never eat late.', 'soon': 'I will return soon.', 'later': 'See you later.',
            'after': 'Come back after lunch.'
        }
        return phrases[word]
    if category == 'question_words':
        phrases = {
            'who': 'Who is that person?', 'what': 'What is this?', 'when': 'When does it open?', 'where': 'Where is the hotel?',
            'why': 'Why are you late?', 'how': 'How do I pay?', 'which': 'Which bus goes there?', 'whose': 'Whose bag is this?',
            'can': 'Can you help me?', 'could': 'Could you repeat that?', 'would': 'Would you like water?',
            'should': 'Should I wait here?', 'may': 'May I come in?', 'if': 'Tell me if possible.',
            'because': 'I came because you called.', 'answer': 'I know the answer.', 'question': 'I have one question.',
            'explain': 'Please explain this slowly.', 'repeat': 'Please repeat that sentence.', 'spell': 'Please spell your name.',
            'mean': 'What does this mean?', 'example': 'Give me one example.', 'difference': 'What is the difference?',
            'choose': 'Please choose one option.', 'compare': 'Compare these two items.', 'describe': 'Describe the problem simply.',
            'list': 'List the main points.', 'option': 'That is one option.', 'reason': 'Tell me the reason.',
            'problem': 'That is the problem.', 'correct': 'Is this correct?', 'wrong': 'Something is wrong.',
            'possible': 'Is that possible?', 'impossible': 'That seems impossible.', 'exact': 'I need the exact amount.',
            'clear': 'That is clear now.', 'unclear': 'This is still unclear.', 'similar': 'These look very similar.',
            'same': 'We want the same.', 'another': 'I need another one.', 'else': 'Anything else today?',
            'either': 'Either one is fine.', 'neither': 'Neither option works.', 'both': 'I need both tickets.',
            'each': 'Each person pays.', 'every': 'Every day I study.', 'any': 'Do you have any?',
            'understand': 'I understand you now.', 'show': 'Please show me.', 'tell': 'Please tell me.'
        }
        return phrases[word]
    if category == 'numbers_quantity':
        ordinal = {'first','second','third','fourth','fifth'}
        if word in ordinal:
            return f'The {word} floor, please.'
        if word in {'many','few','some','all','none','most','other','extra','half','full','empty','single','double','pair','total'}:
            phrases = {
                'many':'I have many bags.','few':'Only a few left.','some':'I need some water.','all':'I want all tickets.',
                'none':'I need none today.','most':'Most seats are free.','other':'I need the other one.','extra':'Do you have extra time?',
                'half':'I want half now.','full':'The room is full.','empty':'The glass is empty.','single':'I need a single room.',
                'double':'I need a double room.','pair':'I need a pair.','total':'What is the total?'
            }
            return phrases[word]
        return f'I need {word} tickets.'
    if category == 'time_calendar':
        if word in {'monday','tuesday','wednesday','thursday','friday','saturday','sunday'}:
            return f'I arrive on {word.title()}.'
        if word in {'january','february','march','april','may','june','july','august','september','october','november','december'}:
            return f'My trip is in {word.title()}.'
        phrases = {
            'time':'What time is it?','day':'Have a nice day.','week':'See you next week.','month':'Next month is busy.',
            'year':'Happy new year!','morning':'Good morning everyone.','afternoon':'Good afternoon to you.','evening':'Good evening everyone.',
            'night':'Good night, sleep well.','noon':'Meet me at noon.','midnight':'The train leaves at midnight.',
            'minute':'Wait one minute.','hour':'I need one hour.','second':'Wait one second.','weekend':'We leave this weekend.',
            'holiday':'The holiday starts tomorrow.','birthday':'Today is my birthday.','spring':'Spring starts soon.',
            'summer':'Summer is very hot.','autumn':'Autumn comes later.','winter':'Winter is very cold.','early':'I arrived early today.',
            'late':'Sorry, I am late.','before':'Call me before dinner.','during':'I work during weekends.','until':'Wait until tomorrow.',
            'schedule':'Show me the schedule.','calendar':'Check the calendar, please.','date':'What is the date?','season':'My favorite season is summer.',
            'future':'Think about the future.'
        }
        return phrases[word]
    if category == 'people_family':
        family = {'mother','father','parent','son','daughter','brother','sister','husband','wife','family','uncle','aunt','cousin','grandmother','grandfather','grandchild'}
        if word in family:
            return f'My {word} is here.'
        return f'The {word} is here.'
    if category == 'directions_places':
        if word in {'north','south','east','west','straight','across','around','between','behind','front'}:
            phrases = {
                'north':'Go north from here.','south':'Walk south two blocks.','east':'The beach is east.','west':'The station is west.',
                'straight':'Go straight ahead.','across':'The bank is across.','around':'Walk around the building.','between':'It is between both shops.',
                'behind':'The hotel is behind.','front':'Wait at the front.'
            }
            return phrases[word]
        return f'Where is the {word}?'
    if category == 'transport_travel':
        if word in {'go','trip','travel','journey'}:
            return f'I love to {word}.' if word == 'travel' else f'The {word} starts now.'
        return f'I need the {word}.'
    if category == 'food_drinks_dining':
        if word in {'menu','table','plate','bowl','spoon','fork','knife','glass','cup','napkin','bill'}:
            return f'I need a {word}.'
        return f'I want {word}, please.'
    if category == 'shopping_money':
        special = {
            'money':'I need more money.','cash':'I pay with cash.','card':'I pay by card.','coin':'I found a coin.',
            'wallet':'My wallet is missing.','price':'What is the price?','cost':'How much does it cost?','change':'Keep the change, please.',
            'discount':'Is there a discount?','receipt':'I need the receipt.','buy':'I want to buy.','sell':'They sell fruit here.',
            'pay':'I will pay now.','return':'I want to return this.','refund':'I need a refund.','cashier':'The cashier is busy.',
            'amount':'Check the amount, please.','tax':'Is tax included?','euro':'I have one euro.','cent':'I need fifty cents.',
            'payment':'The payment is complete.','invoice':'Please send the invoice.','available':'This size is available.','stock':'Is it in stock?',
            'online':'I ordered it online.','delivery':'The delivery comes today.','pickup':'Pickup is at noon.','package':'The package arrived today.',
            'quality':'The quality is good.','warranty':'Does it have warranty?','new':'I want something new.','used':'This item is used.',
            'medium':'I need medium size.','fitting':'Where is the fitting room?','queue':'The queue is long.','basket':'Put it in basket.',
            'mall':'The mall closes early.','checkout':'Go to checkout now.','coupon':'I have a coupon.','barcode':'Scan the barcode, please.',
            'exchange':'Can I exchange this?','purchase':'This was my purchase.','shop':'The shop is open.','size':'What size is this?',
            'color':'I want that color.','product':'This product is cheap.','brand':'I know this brand.','model':'I want this model.','gift':'This is a gift.','sale':'The sale starts today.'
        }
        return special[word]
    if category == 'clothing_personal_items':
        return f'I need a {word}.'
    if category == 'home_household':
        return f'The {word} is here.'
    if category == 'bathroom_hygiene':
        if word in {'clean','dirty','wash','dry'}:
            phrases = {'clean':'The room is clean.','dirty':'My hands are dirty.','wash':'I need to wash.','dry':'Please keep it dry.'}
            return phrases[word]
        return f'I need {word}, please.'
    if category == 'body_health':
        special = {
            'fever':'I have a fever.','pain':'I feel strong pain.','cough':'I have a cough.','virus':'It may be virus.',
            'flu':'I think it is flu.','allergy':'I have an allergy.','wound':'Please clean the wound.','bandage':'I need a bandage.',
            'clinic':'Take me to clinic.','medicine':'I need medicine now.','prescription':'I need a prescription.','appointment':'I have an appointment.',
            'pregnant':'She is pregnant now.','tired':'I feel very tired.','sick':'I feel very sick.','healthy':'I want to stay healthy.',
            'breathe':'Please breathe slowly.','exercise':'I need more exercise.','headache':'I have a headache.','stomachache':'I have a stomachache.',
            'dizzy':'I feel very dizzy.','vomit':'I need to vomit.','nausea':'I feel nausea now.','swelling':'There is swelling here.',
            'injury':'I have an injury.','operation':'The operation is tomorrow.','hospitalbed':'The hospital bed is ready.','tablet':'Take one tablet now.',
            'syrup':'Take the syrup now.','vitamin':'I take one vitamin.','checkup':'I need a checkup.','pulse':'Check my pulse, please.','temperature':'Check my temperature, please.','cramp':'I have a cramp.'
        }
        if word in special:
            return special[word]
        return f'My {word} hurts.'
    if category == 'emergency_safety':
        return f'I need {word} now.'
    if category.startswith('common_verbs'):
        if word in {'be','have','do'}:
            phrases = {'be':'I want to be ready.','have':'I have two tickets.','do':'What should I do?'}
            return phrases[word]
        return f'I want to {word}.'
    if category == 'adjectives_colors':
        if word in {'red','blue','green','yellow','black','white','pink','purple','orange','brown','gray'}:
            return f'It is {word}.'
        return f'It is very {word}.'
    if category == 'weather_nature':
        weather_words = {'stormy','sunny','cloudy','windy','rainy','snowy','warm','cool','dry','wet'}
        if word in weather_words:
            return f'It is {word} today.'
        if word in {'sunrise','sunset'}:
            return f'The {word} is beautiful.'
        return f'I see the {word}.'
    if category == 'work_study_technology':
        return f'I need the {word}.'
    if category == 'social_leisure':
        return f'I like {word}.'
    raise KeyError(category)


def translate_lines(texts: list[str], target: str) -> list[str]:
    joined = '\n'.join(texts)
    url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + target + '&dt=t&q=' + urllib.parse.quote(joined)
    with urllib.request.urlopen(url, timeout=120) as response:
        payload = json.load(response)
    translated = ''.join(part[0] for part in payload[0]).split('\n')
    if len(translated) != len(texts):
        raise RuntimeError(f'translation length mismatch for {target}: expected {len(texts)}, got {len(translated)}')
    return [strip_trailing_period(item.strip()) for item in translated]


def strip_trailing_period(text: str) -> str:
    return re.sub(r'\.\s*$', '', text.strip())


def main() -> None:
    seed_dir = Path('supabase/seeds')
    seed_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for category, words in CATEGORY_WORDS.items():
        if len(words) != 50:
            raise RuntimeError(f'{category} has {len(words)} words, expected 50')
        phrases = [strip_trailing_period(beginner_phrase(category, word)) for word in words]
        es_words = translate_lines(words, 'es')
        ca_words = translate_lines(words, 'ca')
        es_phrases = translate_lines(phrases, 'es')
        ca_phrases = translate_lines(phrases, 'ca')
        for idx, word in enumerate(words, start=1):
            rows.append({
                'category': category,
                'category_order': CATEGORY_ORDER[category],
                'category_position': idx,
                'global_position': len(rows) + 1,
                'english_word': word,
                'spanish_word': es_words[idx - 1],
                'catalan_word': ca_words[idx - 1],
                'english_phrase': phrases[idx - 1],
                'spanish_phrase': es_phrases[idx - 1],
                'catalan_phrase': ca_phrases[idx - 1],
                'published_to': ''
            })
    out_csv = seed_dir / 'language_words_1000.csv'
    with out_csv.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f'wrote {len(rows)} rows to {out_csv}')
    print(rows[0])
    print(rows[-1])


if __name__ == '__main__':
    main()
