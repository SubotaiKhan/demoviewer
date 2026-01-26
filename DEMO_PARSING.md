# CS2 Demo Parsing Guide

This project uses the `@laihoe/demoparser2` library to parse Counter-Strike 2 `.dem` files. This document outlines the strategies, events, and logic used to extract match statistics.

## Overview

The parsing logic is located in `server/index.js`. We extract specific game events to reconstruct the match flow and calculate player performance metrics like K/D, Headshot %, and ADR.

## Key Events Processed

We subscribe to the following events to build the `matchStats` object:

### 1. `player_team`
*   **Purpose**: Tracks which team a player belongs to.
*   **Logic**:
    *   Maps `user_steamid` to `team`.
    *   **Team IDs**:
        *   `2`: Terrorists (T)
        *   `3`: Counter-Terrorists (CT)
    *   Updates are tracked dynamically to handle team swaps (e.g., halftime).

### 2. `player_death`
*   **Purpose**: Calculates Kills, Deaths, Assists, and Headshots.
*   **Fields Used**:
    *   `attacker_steamid` / `attacker_name` (Killer)
    *   `user_steamid` / `user_name` (Victim)
    *   `assister_steamid` (Assister)
    *   `headshot` (Boolean)
*   **Logic**:
    *   Increment `kills` for attacker (if not suicide).
    *   Increment `deaths` for victim.
    *   Increment `assists` for assister.
    *   Increment `headshots` if `headshot` is true.

### 3. `player_hurt`
*   **Purpose**: Calculates Average Damage per Round (ADR).
*   **Fields Used**:
    *   `dmg_health`: Amount of health damage dealt.
    *   `attacker_steamid`: Source of damage.
    *   `user_steamid`: Receiver of damage.
*   **Logic**:
    *   **Friendly Fire Filter**: Damage is ignored if `attacker.team === victim.team`.
    *   Total damage is accumulated per player.
    *   **ADR Calculation**: `Total Damage / Total Valid Rounds`.

### 4. `round_end`
*   **Purpose**: Tracks Match Score and Round History.
*   **Fields Used**:
    *   `winner`: The winning team ID or name ("T"/"CT").
    *   `reason`: The win condition code.
*   **Logic**:
    *   Increments team score based on `winner`.
    *   **Valid Rounds**: Rounds with `winner` 2 or 3 are counted.
    *   **Warmup/Game Start**: Events with `reason: 'game_start'` or invalid winners are ignored.

## Win Reason Codes

The application maps internal reason codes to readable text:

| Code | Description |
|------|-------------|
| `target_bombed` | Bomb Exploded (T Win) |
| `bomb_defused` | Bomb Defused (CT Win) |
| `t_killed` | Terrorists Eliminated |
| `ct_killed` | CTs Eliminated |
| `time_ran_out` | Time Expired |

## Data Structure

The API returns a `matchStats` object:

```json
{
  "score": { "ct": 19, "t": 15 },
  "totalRounds": 34,
  "rounds": [
    { "round": 1, "winner": 3, "reason": "t_killed", "tick": 11046 },
    ...
  ],
  "players": [
    {
      "steamid": "...",
      "name": "PlayerName",
      "team": 3,
      "kills": 25,
      "deaths": 10,
      "assists": 5,
      "headshots": 12,
      "damage": 2500,
      "adr": "85.5"
    }
  ]
}
```
