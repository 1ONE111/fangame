/* 김재원 팬미팅 연습게임 - 스테이지, 스토리, 문구 */
(function () {
  'use strict';
  const FM = (window.FM = window.FM || {});
  const D = (FM.data = {});

  D.title = '김재원 팬미팅 연습게임';

  /* 곡 설정. prog = [근음(키 기준 반음), 'M'|'m'] 한 마디씩
     날이 갈수록 빨라진다: 104 → 120 → 136 BPM */
  D.songs = {
    1: {
      bpm: 104,
      key: 60,
      prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M'], [0, 'M'], [9, 'm'], [2, 'm'], [7, 'M']],
    },
    2: {
      bpm: 120,
      key: 62,
      prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M'], [0, 'M'], [5, 'M'], [2, 'm'], [7, 'M']],
    },
    3: {
      bpm: 136,
      key: 57,
      busy: true,
      prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']],
    },
  };

  /* 채보. P=종이(2박) T=악질(2박) C=폰(2박) W=늑대인간(4박) -=쉬는 칸(2박)
     시청자는 신호 박에 책상 앞에 서고, 그 다음 박에 동작한다. */
  D.charts = {
    1: 'PPPP PPPT PTPP PTPT TPPT PPTT TPTP TTPT PTTP TTTP',
    2: 'PPTP CPCP PTCP CCTP TPCT CPTC PCCT TCPC CTCT PCTC CCTP',
    3: 'PTCP WPT CPW TCPT WW PCTC WTP CTW TPCT WCP CCTT WW PTW TCW',
  };

  /* 동작마다 조작이 정해져 있다.
     손으로 하는 일(싸인, 밴)은 마우스, 몸으로 하는 일(사진, 하울링)은 스페이스. */
  D.types = {
    paper: {
      name: '종이 든 시청자',
      action: '싸인',
      input: 'click',
      pc: '마우스 클릭',
      touch: '화면 탭',
      how: '"띵" 다음 박자에 한 번',
      prompt: '딸깍!',
      promptTouch: '탭!',
    },
    troll: {
      name: '악질 시청자',
      action: '밴',
      input: 'swipe',
      pc: '마우스 누른 채 옆으로 휙',
      touch: '옆으로 스와이프',
      how: '"뿌-" 다음 박자에 밀어내기',
      prompt: '휙!',
      promptTouch: '밀어!',
    },
    phone: {
      name: '폰 든 시청자',
      action: '찰칵찰칵',
      input: 'key',
      pc: '스페이스 두 번',
      touch: '탭 두 번',
      how: '"삐삐" 다음 박자에 빠르게 두 번',
      prompt: '탁탁!',
      promptTouch: '탭탭!',
    },
    wolf: {
      name: '늑대인간 시청자',
      action: '같이 아우우우',
      input: 'hold',
      pc: '스페이스 꾹',
      touch: '화면 꾹',
      how: '"아우~" 다음 박자부터 2박자 동안',
      prompt: '꾹~',
      promptTouch: '꾹~',
    },
  };

  /* 날짜별: 새로 배우는 시청자 */
  D.days = {
    1: { label: '1일차', learn: ['paper', 'troll'], types: ['paper', 'troll'] },
    2: { label: '2일차', learn: ['phone'], types: ['paper', 'troll', 'phone'] },
    3: { label: '3일차', learn: ['wolf'], types: ['paper', 'troll', 'phone', 'wolf'] },
  };

  D.tutorialNeed = 2;

  /* 스토리. who가 비어 있으면 나레이션. */
  D.story = {
    1: [
      { who: '', text: '유튜버 김재원.\n전역하고 첫 팬미팅이 열린다. 무려 3일 동안.', pose: 'down' },
      { who: '재원', text: '야호', pose: 'yaho1' },
      { who: '', text: '그런데 문제가 하나 있다.\n군대에 있는 동안 몸이 완전히 굳어버렸다.', pose: 'think' },
      { who: '재원', text: '이 몸으로... 잘할 수 있을까?', pose: 'think' },
      { who: '', text: '그래서 시작 전에 잠깐 몸부터 풀기로 했다.\n연습 한 번 하고, 바로 실전이다.', pose: 'down' },
      { who: '', text: '종이를 든 시청자에겐 싸인을.\n악질 시청자에겐 밴을.', pose: 'shrug' },
      { who: '재원', text: 'ㄱㄱ', pose: 'yaho1' },
    ],
    2: [
      { who: '', text: '팬미팅 2일차.\n굳었던 손이 좀 풀렸다. 싸인은 이제 좀 한다.', pose: 'down' },
      { who: '재원', text: '야호오오', pose: 'yaho2' },
      { who: '재원', text: '그러네, 어젠 사진 찍어간 사람이 없네?', pose: 'think' },
      { who: '', text: '오늘은 폰을 든 시청자도 온다.\n같이 사진을 찍어달라고 한다.', pose: 'down' },
      { who: '', text: '사진은 한 장으로는 불안하다.\n그래서 두 장 찍는다.', pose: 'shrug' },
      { who: '재원', text: '찰칵찰칵.', pose: 'yaho1' },
    ],
    3: [
      { who: '', text: '팬미팅 3일차.\n몸이 거의 다 풀렸다.', pose: 'down' },
      { who: '재원', text: '드디어 마지막 날이야.\n이상한 사람은 안 나타나겠지?', pose: 'think' },
      { who: '', text: '그런데 제보가 하나 들어왔다.\n시청자 중에 늑대인간이 섞여 있다고 한다.', pose: 'think' },
      { who: '재원', text: '?', pose: 'shrug' },
      { who: '', text: '늑대인간 시청자 앞에서는\n같이 울어줘야 한다. 그것이 예의다.', pose: 'down' },
      { who: '재원', text: '아우우우', pose: 'yaho2' },
      { who: '', text: '악질, 종이, 폰, 늑대인간.\n오늘은 전부 온다.', pose: 'yaho1' },
    ],
    ending: [
      { who: '', text: '그렇게 3일간의 팬미팅이 끝났다.', pose: 'down' },
      { who: '', text: '굳었던 몸이 다 풀렸다.\n싸인도, 밴도, 사진도, 하울링도 문제없었다.', pose: 'shrug' },
      { who: '재원', text: '야호오오오오오!!', pose: 'yaho3' },
      { who: '시청자들', text: '어케했누? 어케했누? 어케했누?', pose: 'yaho3' },
      { who: '', text: '전역 후 첫 팬미팅, 무사히 끝!', pose: 'yaho1' },
      { who: '', text: '그날 밤.', scene: 'sick' },
      { who: '재원', text: '끄응... 몸이 왜 이러누', scene: 'sick' },
      { who: '', text: '전역하고 안 쓰던 몸을 3일 내내 썼더니\n몸살이 나버렸다.', scene: 'sick' },
      { who: '', text: '다음 날 아침.', scene: 'cafe', step: 'write' },
      { who: '재원', text: '(타닥타닥)', scene: 'cafe', step: 'write' },
      { who: '', text: '네이퍼 팬카페에 공지가 올라왔다.', scene: 'cafe', step: 'post' },
      { who: '시청자들', text: '어케했누? 어케했누? 어케했누?', scene: 'cafe', step: 'post' },
      { who: '', text: '- 끝 -\n플레이해주셔서 감사합니다.', scene: 'cafe', step: 'stamp' },
    ],
  };

  /* 엔딩 팬카페 화면 (scene: 'cafe') */
  D.cafe = {
    name: '김재원 팬카페',
    menu: ['전체글보기', '방송공지', '팬카페공지', '김재원이 쓰는 게시판'],
    board: '방송공지',
    opened: '2016.12.26. 개설',
    level: '열매1단계',
    members: '24,965',
    title: '[공지] 오늘 휴방하겠습니다',
    body: ['안녕하세요 김재원입니다.', '3일 동안 팬미팅을 너무 열심히 했더니', '몸살이 났습니다.', '푹 자고 오겠습니다. 야호(작게)'],
    time: '오전 7:12',
    views: 1204,
    stamp: '휴방',
    comments: [
      { who: 'paper', name: '종이든시청자', text: '푹 쉬세요ㅠㅠ' },
      { who: 'troll', name: '악질시청자', text: '그럴 줄 알았다ㅋ' },
      { who: 'phone', name: '폰든시청자', text: '야호를 너무 많이 하셨어' },
      { who: 'wolf', name: '늑대인간', text: '아우우... (걱정)' },
    ],
  };

  /* 결과 등급 */
  D.grades = [
    { id: 'S', min: 90, caption: '야호오오오오오!!', pose: 'yaho3', line: '완벽한 팬미팅이었다.' },
    { id: 'A', min: 75, caption: '야호오오', pose: 'yaho2', line: '꽤 잘했다. 시청자들이 만족했다.' },
    { id: 'B', min: 55, caption: '야호', pose: 'yaho1', line: '어찌저찌 끝냈다. 통과.' },
    { id: 'F', min: 0, caption: '어케했누?', pose: 'lie', line: '팬미팅이 엉망이 됐다. 다시 해보자.' },
  ];
  D.passScore = 55;

  D.trollLines = ['우우~', '노잼', 'ㅡㅡ', '에휴', '뭐함?', 'ㅋ', '하품'];
  D.trollLaugh = ['ㅋㅋㅋㅋ', '개꿀ㅋ', '안 막네ㅋ'];
  D.fanThanks = ['감사합니다!', '꺅', '사랑해요', '가보로 삼을게요', '♥'];
  D.fanSad = ['...', '힝', '저기요?', 'ㅠㅠ'];

  D.judge = {
    perfect: '완벽!',
    good: '굿',
    miss: '삑',
  };
})();
