// src/services/EventQueue/index.ts
// Complete TCG event queue system exports

// EventManager removed - use GameEnvironment direct methods
// PlayerAction moved to EventInterfaces.ts
// ProcessingResult moved to EventInterfaces.ts
export { 
    TriggerEngine, 
    TriggerCondition, 
    RegisteredTrigger, 
    ContinuousEffect,
    CardFilter,
    PlayerFilter 
} from './TriggerEngine';
export { 
    EffectStack, 
    ActivatedEffect, 
    StackResolutionResult, 
    ResponseWindow 
} from './EffectStack';
export { 
    StateBasedActionEngine, 
    StateBasedAction, 
    GameStateViolation 
} from './StateBasedActionEngine';
export { 
    GameEvent, 
    BaseGameEvent,
    CardEntersPlayEvent,
    PowerBoostEvent,
    TurnStartEvent,
    TurnEndEvent,
    StepBeginEvent,
    StepEndEvent,
    PlayCardEvent,
    CostPaidEvent,
    AbilityTriggeredEvent,
    AbilityActivatedEvent,
    AbilityResolvedEvent,
    AttackDeclaredEvent,
    DamageDealtEvent,
    StateBasedActionEvent,
    EventStatus,
    EventPriority
} from './interfaces/GameEvent';
export { EventFactory } from './EventFactory';
