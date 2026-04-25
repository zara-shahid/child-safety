"""
Mental Health API Routes

Provides endpoints for:
- Mood tracking and history
- Anxiety/depression assessments (PHQ-A, GAD-7 adapted for pediatrics)
- Coping strategies and techniques
- Mental health journal entries
- Crisis resources

Inspired by OCD Action (https://github.com/womenhackfornonprofits/ocdaction)
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


# ============== Enums ==============


class MoodLevel(str, Enum):
    VERY_SAD = "very_sad"
    SAD = "sad"
    NEUTRAL = "neutral"
    HAPPY = "happy"
    VERY_HAPPY = "very_happy"


class AnxietyLevel(str, Enum):
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class CopingCategory(str, Enum):
    BREATHING = "breathing"
    GROUNDING = "grounding"
    MOVEMENT = "movement"
    CREATIVE = "creative"
    SOCIAL = "social"
    MINDFULNESS = "mindfulness"
    DISTRACTION = "distraction"


# ============== Models ==============


class MoodEntry(BaseModel):
    id: str = Field(default_factory=lambda: f"mood_{uuid.uuid4().hex[:8]}")
    child_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    mood_level: MoodLevel
    energy_level: int = Field(ge=1, le=5, description="1-5 scale")
    anxiety_level: int = Field(ge=0, le=10, description="0-10 scale")
    sleep_quality: int | None = Field(None, ge=1, le=5)
    notes: str | None = None
    triggers: list[str] | None = None
    activities: list[str] | None = None


class MoodEntryCreate(BaseModel):
    child_id: str
    mood_level: MoodLevel
    energy_level: int = Field(ge=1, le=5)
    anxiety_level: int = Field(ge=0, le=10)
    sleep_quality: int | None = Field(None, ge=1, le=5)
    notes: str | None = None
    triggers: list[str] | None = None
    activities: list[str] | None = None


class JournalEntry(BaseModel):
    id: str = Field(default_factory=lambda: f"journal_{uuid.uuid4().hex[:8]}")
    child_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    title: str | None = None
    content: str
    mood_before: MoodLevel | None = None
    mood_after: MoodLevel | None = None
    is_private: bool = True
    tags: list[str] | None = None


class JournalEntryCreate(BaseModel):
    child_id: str
    title: str | None = None
    content: str
    mood_before: MoodLevel | None = None
    mood_after: MoodLevel | None = None
    is_private: bool = True
    tags: list[str] | None = None


class AnxietyAssessmentQuestion(BaseModel):
    id: int
    text: str
    child_friendly_text: str


class AnxietyAssessmentAnswer(BaseModel):
    question_id: int
    score: int = Field(
        ge=0, le=3, description="0=Not at all, 1=Several days, 2=More than half, 3=Nearly every day"
    )


class AnxietyAssessmentSubmit(BaseModel):
    child_id: str
    assessment_type: str = "GAD-7"  # or "PHQ-A"
    answers: list[AnxietyAssessmentAnswer]


class AnxietyAssessmentResult(BaseModel):
    id: str = Field(default_factory=lambda: f"assess_{uuid.uuid4().hex[:8]}")
    child_id: str
    assessment_type: str
    timestamp: datetime = Field(default_factory=datetime.now)
    total_score: int
    severity: AnxietyLevel
    interpretation: str
    recommendations: list[str]


class CopingStrategy(BaseModel):
    id: str
    name: str
    description: str
    category: CopingCategory
    age_appropriate_min: int
    age_appropriate_max: int
    duration_minutes: int
    steps: list[str]
    benefits: list[str]
    when_to_use: list[str]
    icon: str


class CrisisResource(BaseModel):
    name: str
    description: str
    phone: str | None = None
    text_line: str | None = None
    website: str | None = None
    available_24_7: bool
    for_children: bool
    for_parents: bool


# ============== In-Memory Storage (Demo) ==============

mood_entries: list[MoodEntry] = []
journal_entries: list[JournalEntry] = []
assessment_results: list[AnxietyAssessmentResult] = []


# ============== GAD-7 Questions (Adapted for Children) ==============

GAD7_QUESTIONS: list[AnxietyAssessmentQuestion] = [
    AnxietyAssessmentQuestion(
        id=1,
        text="Feeling nervous, anxious, or on edge",
        child_friendly_text="Do you feel worried or scared a lot?",
    ),
    AnxietyAssessmentQuestion(
        id=2,
        text="Not being able to stop or control worrying",
        child_friendly_text="Is it hard to stop thinking about scary or worrying things?",
    ),
    AnxietyAssessmentQuestion(
        id=3,
        text="Worrying too much about different things",
        child_friendly_text="Do you worry about lots of different things?",
    ),
    AnxietyAssessmentQuestion(
        id=4,
        text="Trouble relaxing",
        child_friendly_text="Is it hard for you to relax and feel calm?",
    ),
    AnxietyAssessmentQuestion(
        id=5,
        text="Being so restless that it's hard to sit still",
        child_friendly_text="Do you feel like you can't sit still or need to move around?",
    ),
    AnxietyAssessmentQuestion(
        id=6,
        text="Becoming easily annoyed or irritable",
        child_friendly_text="Do you get grumpy or upset easily?",
    ),
    AnxietyAssessmentQuestion(
        id=7,
        text="Feeling afraid as if something awful might happen",
        child_friendly_text="Do you feel like something bad might happen?",
    ),
]


# ============== Coping Strategies Database ==============

COPING_STRATEGIES: list[CopingStrategy] = [
    CopingStrategy(
        id="breathe_1",
        name="Bubble Breathing",
        description="Pretend you're blowing bubbles to slow down your breathing",
        category=CopingCategory.BREATHING,
        age_appropriate_min=3,
        age_appropriate_max=10,
        duration_minutes=3,
        steps=[
            "Get comfortable and close your eyes",
            "Imagine you're holding a bubble wand",
            "Take a deep breath in through your nose (count to 4)",
            "Slowly blow out through your mouth like you're making a big bubble",
            "Watch your imaginary bubble float away",
            "Repeat 5 times",
        ],
        benefits=["Calms the nervous system", "Reduces anxiety quickly", "Easy to do anywhere"],
        when_to_use=["Feeling anxious", "Before bed", "After an upsetting event"],
        icon="wind",
    ),
    CopingStrategy(
        id="breathe_2",
        name="4-7-8 Breathing",
        description="A powerful breathing technique to calm anxiety fast",
        category=CopingCategory.BREATHING,
        age_appropriate_min=8,
        age_appropriate_max=18,
        duration_minutes=5,
        steps=[
            "Sit or lie down comfortably",
            "Breathe in quietly through your nose for 4 seconds",
            "Hold your breath for 7 seconds",
            "Exhale completely through your mouth for 8 seconds",
            "Repeat the cycle 3-4 times",
        ],
        benefits=["Activates relaxation response", "Helps with sleep", "Reduces panic symptoms"],
        when_to_use=["Panic attacks", "Can't fall asleep", "Feeling overwhelmed"],
        icon="heart-pulse",
    ),
    CopingStrategy(
        id="ground_1",
        name="5-4-3-2-1 Grounding",
        description="Use your senses to come back to the present moment",
        category=CopingCategory.GROUNDING,
        age_appropriate_min=5,
        age_appropriate_max=18,
        duration_minutes=5,
        steps=[
            "Look around and name 5 things you can SEE",
            "Touch and name 4 things you can FEEL",
            "Listen and name 3 things you can HEAR",
            "Notice 2 things you can SMELL",
            "Name 1 thing you can TASTE",
        ],
        benefits=["Stops spiraling thoughts", "Brings focus to present", "Works during panic"],
        when_to_use=["Feeling disconnected", "Anxious thoughts racing", "Panic attack starting"],
        icon="eye",
    ),
    CopingStrategy(
        id="ground_2",
        name="Safe Place Visualization",
        description="Imagine yourself in a calm, safe place",
        category=CopingCategory.GROUNDING,
        age_appropriate_min=6,
        age_appropriate_max=18,
        duration_minutes=10,
        steps=[
            "Close your eyes and take 3 deep breaths",
            "Picture a place where you feel completely safe and happy",
            "Notice what you see in this place - colors, objects, scenery",
            "What sounds do you hear there?",
            "What does it feel like? Warm? Cool? Cozy?",
            "Stay in your safe place for a few minutes",
            "When ready, slowly open your eyes",
        ],
        benefits=["Creates mental escape", "Builds coping resource", "Reduces fear response"],
        when_to_use=["Feeling unsafe", "Before stressful events", "Nighttime fears"],
        icon="shield",
    ),
    CopingStrategy(
        id="move_1",
        name="Shake It Off",
        description="Physical movement to release stress and tension",
        category=CopingCategory.MOVEMENT,
        age_appropriate_min=3,
        age_appropriate_max=12,
        duration_minutes=3,
        steps=[
            "Stand up with feet shoulder-width apart",
            "Start shaking your hands really fast",
            "Now shake your arms",
            "Add your shoulders, wiggling them up and down",
            "Shake your whole body! Jump around!",
            "Slow down gradually",
            "Take 3 deep breaths and notice how you feel",
        ],
        benefits=["Releases physical tension", "Fun and engaging", "Shifts mood quickly"],
        when_to_use=["Feeling tense or angry", "Lots of energy", "Need a quick reset"],
        icon="zap",
    ),
    CopingStrategy(
        id="move_2",
        name="Butterfly Hug",
        description="Self-soothing technique using bilateral stimulation",
        category=CopingCategory.MOVEMENT,
        age_appropriate_min=4,
        age_appropriate_max=18,
        duration_minutes=5,
        steps=[
            "Cross your arms over your chest, hands on shoulders",
            "Your hands are like butterfly wings",
            "Slowly tap alternating hands - left, right, left, right",
            "Keep a slow, steady rhythm",
            "Close your eyes and think of something calming",
            "Continue for 2-3 minutes",
        ],
        benefits=["Self-soothing", "Can be done discreetly", "EMDR-based technique"],
        when_to_use=["Feeling sad or scared", "After upsetting news", "Need comfort"],
        icon="heart",
    ),
    CopingStrategy(
        id="creative_1",
        name="Worry Box",
        description="Write down worries to get them out of your head",
        category=CopingCategory.CREATIVE,
        age_appropriate_min=5,
        age_appropriate_max=14,
        duration_minutes=10,
        steps=[
            "Get a box or container (decorate it if you want!)",
            "Write each worry on a small piece of paper",
            "Fold the paper and put it in the box",
            "Close the box - your worries are safe there",
            "You can throw them away later or talk about them with someone",
            "The worries don't need to stay in your head",
        ],
        benefits=["Externalizes worries", "Creates sense of control", "Good for bedtime worries"],
        when_to_use=["Mind won't stop worrying", "Before sleep", "Feeling overwhelmed"],
        icon="box",
    ),
    CopingStrategy(
        id="creative_2",
        name="Feelings Art",
        description="Express emotions through drawing or coloring",
        category=CopingCategory.CREATIVE,
        age_appropriate_min=3,
        age_appropriate_max=18,
        duration_minutes=15,
        steps=[
            "Get paper and coloring supplies",
            "Think about how you're feeling right now",
            "Pick colors that match your feelings",
            "Draw, scribble, or color - no rules!",
            "It doesn't have to look like anything",
            "Notice how you feel after creating",
        ],
        benefits=["Non-verbal expression", "Releases emotions", "Meditative"],
        when_to_use=["Hard to put feelings into words", "Feel like crying", "Need to process"],
        icon="palette",
    ),
    CopingStrategy(
        id="mindful_1",
        name="Body Scan",
        description="Notice sensations in different parts of your body",
        category=CopingCategory.MINDFULNESS,
        age_appropriate_min=7,
        age_appropriate_max=18,
        duration_minutes=10,
        steps=[
            "Lie down or sit comfortably",
            "Close your eyes and take 3 deep breaths",
            "Focus attention on your toes - notice any feelings there",
            "Slowly move attention up: feet, legs, tummy, chest",
            "Continue to arms, hands, neck, face, top of head",
            "If you find tension, breathe into that area",
            "End by noticing your whole body at once",
        ],
        benefits=[
            "Increases body awareness",
            "Identifies where stress is held",
            "Promotes relaxation",
        ],
        when_to_use=["Before bed", "Feeling tense", "Need to slow down"],
        icon="scan",
    ),
    CopingStrategy(
        id="social_1",
        name="Talk to Someone You Trust",
        description="Sharing feelings with a trusted person",
        category=CopingCategory.SOCIAL,
        age_appropriate_min=4,
        age_appropriate_max=18,
        duration_minutes=15,
        steps=[
            "Think of someone you trust (parent, teacher, friend)",
            "Find a good time to talk",
            "Start by saying 'I've been feeling...'",
            "It's okay if you cry or feel awkward",
            "Let them know if you want advice or just want them to listen",
            "Thank them for listening",
        ],
        benefits=["Reduces isolation", "Gets support", "Builds connection"],
        when_to_use=["Feeling alone", "Big worries", "Something happened"],
        icon="users",
    ),
    CopingStrategy(
        id="distract_1",
        name="The ABC Game",
        description="A distraction technique using the alphabet",
        category=CopingCategory.DISTRACTION,
        age_appropriate_min=5,
        age_appropriate_max=14,
        duration_minutes=5,
        steps=[
            "Pick a category (animals, foods, places, names)",
            "Go through the alphabet: A is for... B is for...",
            "Try to think of something for each letter",
            "If you get stuck, skip to the next letter",
            "See if you can get through the whole alphabet!",
        ],
        benefits=["Redirects anxious thoughts", "Engages the mind", "Can do anywhere"],
        when_to_use=["Waiting for something scary", "Can't stop worrying", "Need distraction"],
        icon="list-ordered",
    ),
]


# ============== Crisis Resources ==============

CRISIS_RESOURCES: list[CrisisResource] = [
    CrisisResource(
        name="988 Suicide & Crisis Lifeline",
        description="Free, confidential support for people in distress",
        phone="988",
        text_line="Text 988",
        website="https://988lifeline.org",
        available_24_7=True,
        for_children=True,
        for_parents=True,
    ),
    CrisisResource(
        name="Crisis Text Line",
        description="Text-based crisis support for any crisis",
        text_line="Text HOME to 741741",
        website="https://www.crisistextline.org",
        available_24_7=True,
        for_children=True,
        for_parents=True,
    ),
    CrisisResource(
        name="SAMHSA National Helpline",
        description="Treatment referral service for mental health and substance abuse",
        phone="1-800-662-4357",
        website="https://www.samhsa.gov/find-help/national-helpline",
        available_24_7=True,
        for_children=False,
        for_parents=True,
    ),
    CrisisResource(
        name="Childhelp National Child Abuse Hotline",
        description="For children who are being abused or know someone who is",
        phone="1-800-422-4453",
        website="https://www.childhelp.org",
        available_24_7=True,
        for_children=True,
        for_parents=True,
    ),
    CrisisResource(
        name="The Trevor Project",
        description="Crisis support for LGBTQ+ young people",
        phone="1-866-488-7386",
        text_line="Text START to 678-678",
        website="https://www.thetrevorproject.org",
        available_24_7=True,
        for_children=True,
        for_parents=False,
    ),
    CrisisResource(
        name="Boys Town National Hotline",
        description="For kids and teens with any problem, any time",
        phone="1-800-448-3000",
        website="https://www.boystown.org/hotline",
        available_24_7=True,
        for_children=True,
        for_parents=True,
    ),
]


# ============== API Endpoints ==============

# ----- Mood Tracking -----


@router.post("/mood", response_model=MoodEntry, tags=["Mental Health"])
async def log_mood(entry: MoodEntryCreate) -> MoodEntry:
    """Log a mood entry for a child"""
    mood_entry = MoodEntry(**entry.model_dump())
    mood_entries.append(mood_entry)
    return mood_entry


@router.get("/mood/{child_id}", response_model=list[MoodEntry], tags=["Mental Health"])
async def get_mood_history(child_id: str, days: int = 30) -> list[MoodEntry]:
    """Get mood history for a child"""
    from datetime import timedelta

    cutoff = datetime.now() - timedelta(days=days)
    return [e for e in mood_entries if e.child_id == child_id and e.timestamp > cutoff]


@router.get("/mood/{child_id}/summary", tags=["Mental Health"])
async def get_mood_summary(child_id: str, days: int = 7) -> dict[str, Any]:
    """Get mood summary and trends for a child"""
    from datetime import timedelta

    cutoff = datetime.now() - timedelta(days=days)
    entries = [e for e in mood_entries if e.child_id == child_id and e.timestamp > cutoff]

    if not entries:
        return {"has_data": False, "message": "No mood data for this period"}

    mood_values = {
        MoodLevel.VERY_SAD: 1,
        MoodLevel.SAD: 2,
        MoodLevel.NEUTRAL: 3,
        MoodLevel.HAPPY: 4,
        MoodLevel.VERY_HAPPY: 5,
    }

    avg_mood = sum(mood_values[e.mood_level] for e in entries) / len(entries)
    avg_anxiety = sum(e.anxiety_level for e in entries) / len(entries)
    avg_energy = sum(e.energy_level for e in entries) / len(entries)

    # Find common triggers
    all_triggers = []
    for e in entries:
        if e.triggers:
            all_triggers.extend(e.triggers)

    trigger_counts: dict[str, int] = {}
    for t in all_triggers:
        trigger_counts[t] = trigger_counts.get(t, 0) + 1

    top_triggers = sorted(trigger_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "has_data": True,
        "period_days": days,
        "total_entries": len(entries),
        "average_mood": round(avg_mood, 1),
        "average_anxiety": round(avg_anxiety, 1),
        "average_energy": round(avg_energy, 1),
        "mood_trend": (
            "improving"
            if len(entries) > 1
            and mood_values[entries[-1].mood_level] > mood_values[entries[0].mood_level]
            else "stable"
        ),
        "top_triggers": [{"trigger": t, "count": c} for t, c in top_triggers],
        "recommendation": _get_mood_recommendation(avg_mood, avg_anxiety),
    }


def _get_mood_recommendation(avg_mood: float, avg_anxiety: float) -> str:
    if avg_anxiety > 7:
        return "Anxiety levels have been high. Consider practicing daily breathing exercises and speaking with a healthcare provider."
    elif avg_mood < 2.5:
        return "Mood has been low lately. Try to include fun activities and consider talking to someone you trust."
    elif avg_mood >= 4:
        return "Great mood patterns! Keep doing what works for you."
    else:
        return "Things seem stable. Remember to check in with feelings regularly."


# ----- Journal -----


@router.post("/journal", response_model=JournalEntry, tags=["Mental Health"])
async def create_journal_entry(entry: JournalEntryCreate) -> JournalEntry:
    """Create a new journal entry"""
    journal_entry = JournalEntry(**entry.model_dump())
    journal_entries.append(journal_entry)
    return journal_entry


@router.get("/journal/{child_id}", response_model=list[JournalEntry], tags=["Mental Health"])
async def get_journal_entries(child_id: str, limit: int = 20) -> list[JournalEntry]:
    """Get journal entries for a child"""
    entries = [e for e in journal_entries if e.child_id == child_id]
    entries.sort(key=lambda x: x.timestamp, reverse=True)
    return entries[:limit]


@router.delete("/journal/{entry_id}", tags=["Mental Health"])
async def delete_journal_entry(entry_id: str) -> dict[str, str]:
    """Delete a journal entry"""
    global journal_entries
    journal_entries = [e for e in journal_entries if e.id != entry_id]
    return {"status": "deleted"}


# ----- Anxiety Assessment -----


@router.get("/assessment/questions/{assessment_type}", tags=["Mental Health"])
async def get_assessment_questions(assessment_type: str = "GAD-7") -> dict[str, Any]:
    """Get questions for an anxiety/depression assessment"""
    if assessment_type == "GAD-7":
        return {
            "assessment_type": "GAD-7",
            "title": "Generalized Anxiety Disorder Assessment",
            "description": "Over the last 2 weeks, how often have you been bothered by the following?",
            "scoring": {
                "0": "Not at all",
                "1": "Several days",
                "2": "More than half the days",
                "3": "Nearly every day",
            },
            "questions": GAD7_QUESTIONS,
        }
    else:
        raise HTTPException(status_code=404, detail="Assessment type not found")


@router.post("/assessment/submit", response_model=AnxietyAssessmentResult, tags=["Mental Health"])
async def submit_assessment(submission: AnxietyAssessmentSubmit) -> AnxietyAssessmentResult:
    """Submit an anxiety assessment and get results"""
    total_score = sum(a.score for a in submission.answers)

    # Determine severity
    if total_score <= 4:
        severity = AnxietyLevel.NONE
        interpretation = "Minimal anxiety symptoms"
        recommendations = [
            "Continue monitoring mood",
            "Practice regular self-care",
            "Maintain healthy sleep habits",
        ]
    elif total_score <= 9:
        severity = AnxietyLevel.MILD
        interpretation = "Mild anxiety symptoms"
        recommendations = [
            "Try relaxation techniques like deep breathing",
            "Regular physical activity can help",
            "Talk to a trusted adult about your feelings",
            "Consider using coping strategies from the app",
        ]
    elif total_score <= 14:
        severity = AnxietyLevel.MODERATE
        interpretation = "Moderate anxiety symptoms"
        recommendations = [
            "Speak with a parent or trusted adult",
            "Consider consulting with a healthcare provider",
            "Practice daily anxiety management techniques",
            "Limit screen time before bed",
            "Regular exercise is important",
        ]
    else:
        severity = AnxietyLevel.SEVERE
        interpretation = "Severe anxiety symptoms"
        recommendations = [
            "Please speak with a parent or guardian right away",
            "Consider scheduling an appointment with a mental health professional",
            "Use crisis resources if you're feeling overwhelmed",
            "Remember: anxiety is treatable and you can feel better",
            "Don't try to manage this alone",
        ]

    result = AnxietyAssessmentResult(
        child_id=submission.child_id,
        assessment_type=submission.assessment_type,
        total_score=total_score,
        severity=severity,
        interpretation=interpretation,
        recommendations=recommendations,
    )

    assessment_results.append(result)
    return result


@router.get(
    "/assessment/history/{child_id}",
    response_model=list[AnxietyAssessmentResult],
    tags=["Mental Health"],
)
async def get_assessment_history(child_id: str) -> list[AnxietyAssessmentResult]:
    """Get assessment history for a child"""
    return [r for r in assessment_results if r.child_id == child_id]


# ----- Coping Strategies -----


@router.get("/coping/strategies", response_model=list[CopingStrategy], tags=["Mental Health"])
async def get_coping_strategies(
    age: int | None = None, category: CopingCategory | None = None
) -> list[CopingStrategy]:
    """Get coping strategies, optionally filtered by age and category"""
    strategies = COPING_STRATEGIES

    if age is not None:
        strategies = [
            s for s in strategies if s.age_appropriate_min <= age <= s.age_appropriate_max
        ]

    if category is not None:
        strategies = [s for s in strategies if s.category == category]

    return strategies


@router.get(
    "/coping/strategies/{strategy_id}", response_model=CopingStrategy, tags=["Mental Health"]
)
async def get_coping_strategy(strategy_id: str) -> CopingStrategy:
    """Get a specific coping strategy by ID"""
    for strategy in COPING_STRATEGIES:
        if strategy.id == strategy_id:
            return strategy
    raise HTTPException(status_code=404, detail="Strategy not found")


@router.get("/coping/categories", tags=["Mental Health"])
async def get_coping_categories() -> list[dict[str, Any]]:
    """Get all coping strategy categories"""
    return [
        {
            "id": CopingCategory.BREATHING,
            "name": "Breathing Exercises",
            "description": "Techniques to calm your body through breath",
            "icon": "wind",
        },
        {
            "id": CopingCategory.GROUNDING,
            "name": "Grounding",
            "description": "Ways to feel present and connected",
            "icon": "anchor",
        },
        {
            "id": CopingCategory.MOVEMENT,
            "name": "Movement",
            "description": "Physical activities to release stress",
            "icon": "activity",
        },
        {
            "id": CopingCategory.CREATIVE,
            "name": "Creative Expression",
            "description": "Art and writing for emotional release",
            "icon": "palette",
        },
        {
            "id": CopingCategory.MINDFULNESS,
            "name": "Mindfulness",
            "description": "Awareness and meditation practices",
            "icon": "brain",
        },
        {
            "id": CopingCategory.SOCIAL,
            "name": "Social Support",
            "description": "Connecting with others",
            "icon": "users",
        },
        {
            "id": CopingCategory.DISTRACTION,
            "name": "Healthy Distraction",
            "description": "Ways to redirect anxious thoughts",
            "icon": "sparkles",
        },
    ]


# ----- Crisis Resources -----


@router.get("/crisis/resources", response_model=list[CrisisResource], tags=["Mental Health"])
async def get_crisis_resources(for_children: bool | None = None) -> list[CrisisResource]:
    """Get crisis resources and hotlines"""
    resources = CRISIS_RESOURCES

    if for_children is not None:
        if for_children:
            resources = [r for r in resources if r.for_children]
        else:
            resources = [r for r in resources if r.for_parents]

    return resources


@router.get("/crisis/emergency-check", tags=["Mental Health"])
async def emergency_check(
    suicidal_thoughts: bool = False, self_harm: bool = False, immediate_danger: bool = False
) -> dict[str, Any]:
    """Check if immediate crisis intervention is needed"""
    if any([suicidal_thoughts, self_harm, immediate_danger]):
        return {
            "is_crisis": True,
            "message": "Please reach out for help immediately. You are not alone.",
            "immediate_action": "Call 988 (Suicide & Crisis Lifeline) or text HOME to 741741",
            "resources": [r for r in CRISIS_RESOURCES if r.available_24_7][:3],
        }

    return {
        "is_crisis": False,
        "message": "Thank you for checking in. Remember, it's always okay to ask for help.",
        "resources": CRISIS_RESOURCES[:2],
    }
