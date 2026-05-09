#!/bin/bash
# AI Novel 端到端测试 — 从注册到生成提示词
# 启动后端后运行: bash scripts/e2e-test.sh
set -e

BASE="${1:-http://localhost:8000}"

echo "=== 1. 注册测试用户 ==="
REG=$(curl -sf -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ainovel.cn","password":"test123","display_name":"测试作者"}')
echo "$REG" | python3 -m json.tool
TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== 2. 创建项目 ==="
PROJ=$(curl -sf -X POST "$BASE/api/projects" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"钟声","synopsis":"三年前的一桩悬案，一个被调走的前刑警，一个失踪的证人。当陆征开始调查时，他发现所有的线索都指向他自己。","genre_profile":"suspense-crime"}')
echo "$PROJ" | python3 -m json.tool
PROJ_ID=$(echo "$PROJ" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
SLUG=$(echo "$PROJ" | python3 -c "import sys,json; print(json.load(sys.stdin)['slug'])")

echo ""
echo "=== 3. AI 起名建议（测试 AI 连通性） ==="
curl -sf -X POST "$BASE/api/ai/suggest-meta" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"premise":"一个退役刑警在调查三年前的悬案时，发现所有线索都指向他自己"}' \
  | python3 -m json.tool

echo ""
echo "=== 4. 创建卷 ==="
curl -sf -X POST "$BASE/api/projects/$PROJ_ID/volumes" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"vol_num":1,"title":"第一卷"}' | python3 -m json.tool

echo ""
echo "=== 5. 创建章节（含完整章纲） ==="
CHAPTER_DATA='{
  "volume":1,"chapter":1,"title":"第一声钟响",
  "status":"outline",
  "outline":{
    "summary":"陆征接到苏沫的委托，调查她姐姐苏棠的失踪案。警方判定为普通失踪，但苏沫坚持认为事有蹊跷。",
    "key_points":["苏沫来访","查看苏棠公寓","发现遗留的线索"],
    "characters":["陆征","苏沫"],
    "location":"陆征的办公室、苏棠的公寓",
    "time":"早晨到下午",
    "narrative_pov":"第三人称有限视角"
  },
  "memo":{
    "current_task":"陆征接手苏棠失踪案的调查，初步了解案情",
    "reader_expectation":{"state":"好奇","strategy":"制造新缺口","detail":"苏棠为什么失踪？她发现了什么？"},
    "required_changes":["陆征从观望转为正式介入调查"],
    "prohibitions":["不要过早揭示灰短袖的身份"],
    "key_choices":["陆征决定是否接下这个案子"]
  },
  "emotional_design":{
    "primary_mood":"好奇","mood_progression":"松驰→好奇→紧绷","intensity_peak":"公寓场景",
    "satisfaction_beat":"陆征发现苏棠留下的纸条","emotional_hook":"悬念","intensity_level":4
  },
  "segments":[
    {"seg_number":1,"function":"atmosphere","goal":"清晨办公室的日常氛围","what_to_write":"陆征坐在办公室整理旧案卷。窗外钟楼敲响三下。电话响起——前同事老方推荐了一个委托人。","characters":["陆征"],"emotional_tone":"放松","word_target":300,"ends_with":"苏沫推门进来——一个二十出头的女孩，眼圈发红，手里攥着一沓照片。"},
    {"seg_number":2,"function":"dialogue_push","goal":"苏沫讲述案情","what_to_write":"苏沫描述姐姐苏棠失踪前的情况。苏棠是物流公司文员，失踪前两周行为异常——换了手机号，搬了住处，不再和任何人联系。警方判定为主动失踪，但苏沫不信。","characters":["陆征","苏沫"],"emotional_tone":"好奇","word_target":500,"ends_with":"陆征从苏沫手里接过照片——照片上的苏棠穿着蓝色工作服，站在物流仓库前，身后有个模糊的灰色人影。"},
    {"seg_number":3,"function":"character_beat","goal":"陆征独自决定","what_to_write":"苏沫离开后，陆征翻看案卷。一个简单的失踪案，警方已经结案。但他注意到照片上的灰色人影——那个人身上穿的是保安制服，胸前有个徽章。他拿起电话拨给老方。","characters":["陆征"],"emotional_tone":"专注","word_target":400,"ends_with":"老方在电话里沉默了几秒，然后说：'那个片子……最好别碰。'挂了。"},
    {"seg_number":4,"function":"revelation","goal":"发现关键线索","what_to_write":"陆征独自去了苏棠最后住的公寓。公寓已经被清空，只留下一个空衣柜和一张床垫。他在床垫下面找到一张揉皱的物流单——收货地址不是苏棠的住址，是一个城中村的门牌号。","characters":["陆征"],"emotional_tone":"紧绷","word_target":400,"ends_with":"物流单上的日期是苏棠失踪前三天。发货人写的不是苏棠的名字，写的是'老马'。"},
    {"seg_number":5,"function":"emotional_landing","goal":"章末钩子——陆征决定查下去","what_to_write":"陆征把物流单夹进笔记本，开车回事务所。路过钟楼时，钟声敲了六下——晚高峰的车流把他堵在路口。后视镜里，他看到一辆灰色面包车跟在自己后面，和刚才来的时候一样。","characters":["陆征"],"emotional_tone":"不安","word_target":300,"ends_with":"面包车的雾灯亮了一下，然后关了。像是有人确认他在看。"}
  ]
}'
curl -sf -X PUT "$BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "$CHAPTER_DATA" | python3 -m json.tool

echo ""
echo "=== 6. 确认章节（触发 gate 检查） ==="
curl -sf -X POST "$BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1/confirm" \
  -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== 7. 生成提示词 ==="
curl -sf -X POST "$BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1/prompts/generate" \
  -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== 8. 查看生成的提示词文件 ==="
curl -sf "$BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1/prompts" \
  -H "$AUTH" | python3 -m json.tool

echo ""
echo "=== 9. 查看第一个提示词内容（前 500 字符） ==="
curl -sf "$BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1/prompts/seg-1" \
  -H "$AUTH" | head -c 500

echo ""
echo ""
echo "=== 端到端测试完成 ==="
echo "项目: http://localhost:3000/project/$SLUG"
echo "写作: curl $BASE/api/projects/$PROJ_ID/chapters/vol-1-ch-1/write/stream/1 -H '$AUTH'"