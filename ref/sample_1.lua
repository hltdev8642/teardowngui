--Place a configurable smoke emitter in the world
-- Now with: color modes, toggle/hold, safety checks, secondary boost, better config, performance tweaks, and original silly comments!

----------------------------------------------------------------
-- STATE
----------------------------------------------------------------
local snd = nil
local emit = false
local shutup = false
local ui = false

local emitBody = nil
local emitPos = Vec(0,0,0)
local emitDir = Vec(0,0,1)
local emitTimer = 0
local lastSoundPos = Vec(0,0,0)
local hitShape = 0 -- shape we attached to
local bindingCapture = false -- capture mode for UI key
-- New UI state for rebuilt settings panel
local panelPosX, panelPosY = 0, 0
local panelW, panelH = 480, 520 -- enlarged panel size
local panelDragging = false
local panelDragOffX, panelDragOffY = 0,0
local panelScroll = 0
local panelScrollTarget = 0
local panelSectionOpen = { main=true, visuals=true, behavior=true, keys=true }
local panelInitialized = false

-- New state additions
local pressureCharge = 0          -- 0-1 while building pressure
local pressureEmitRemaining = 0    -- time left for a pressure burst
local steamTimer = 0               -- accumulator for steam spawning cadence
local profileNames = {"Performance","Quality","Realistic","Arcade"}
local CFG = {}
local DEFAULTS = {
    mode = "hold", -- toggle|hold|pressure
    secondaryBoost = false,
    droplets = false,
    baseCount = 3,
    radius = 0.7,
    life = 20,
    gravity = -30,
    drag = 1.0,
    velocity = 10,
    alphaStart = 1.0,
    alphaEnd = 0.0,
    colorMode = "Preset",
    preset = "Classic tdWater",
    customR = 0,
    customG = 0.5,
    customB = 1.0,
    shape = "cone", -- cone|fan|jet
    spread = 1.0,   -- generic spread scalar (adjustable by wheel)
    uiToggleKey = "map",
    uiAnchor = "center" -- center|topleft|topright|bottomleft|bottomright
}

-- Preset profile parameter overrides (ID 30)
local PROFILE_PRESETS = {
    Performance = { baseCount=2, radius=0.55, drag=0.8, life=15, velocity=9 },
    Quality     = { baseCount=5, radius=0.8, drag=1.0, life=22, velocity=11 },
    Realistic   = { baseCount=4, radius=0.7, drag=1.2, life=24, velocity=10, gravity=-35 },
    Arcade      = { baseCount=7, radius=0.9, drag=0.7, life=18, velocity=14 }
}

local function clamp(v, mi, ma) if v < mi then return mi elseif v > ma then return ma else return v end end

----------------------------------------------------------------
-- HELPERS
----------------------------------------------------------------

--Helper to return a random vector of particular length
function rndVec(length)
	local v = VecNormalize(Vec(math.random(-100,100), math.random(-100,100), math.random(-100,100)))
	return VecScale(v, length)	
end

--Helper to return a random number in range mi to ma
function rnd(mi, ma)
	return math.random(1000)/1000*(ma-mi) + mi
end

local function bodyValid(b)
    if not b or b==0 then return false end
    local ok, t = pcall(GetBodyTransform, b)
    return ok and t ~= nil
end

-- CONFIG (refactor ID 23)
local function loadBaseConfig()
    for k,v in pairs(DEFAULTS) do CFG[k] = v end
    -- registry overrides
    CFG.mode = GetString("savegame.mod.tdwater.mode"); if CFG.mode=="" then CFG.mode=DEFAULTS.mode end
    CFG.secondaryBoost  = GetBool("savegame.mod.tdwater.secondaryBoost")
    CFG.droplets        = GetBool("savegame.mod.tdwater.droplets")
    CFG.baseCount       = tonumber(GetString("savegame.mod.tdwater.count"))    or CFG.baseCount
    CFG.radius          = tonumber(GetString("savegame.mod.tdwater.radius"))   or CFG.radius
    CFG.life            = tonumber(GetString("savegame.mod.tdwater.life"))     or CFG.life
    CFG.gravity         = tonumber(GetString("savegame.mod.tdwater.gravity"))  or CFG.gravity
    CFG.drag            = tonumber(GetString("savegame.mod.tdwater.drag"))     or CFG.drag
    CFG.velocity        = tonumber(GetString("savegame.mod.tdwater.velocity")) or CFG.velocity
    CFG.colorMode       = GetString("savegame.mod.tdwater.colormode"); if CFG.colorMode=="" then CFG.colorMode=DEFAULTS.colorMode end
    CFG.preset          = GetString("savegame.mod.color"); if CFG.preset=="" then CFG.preset = DEFAULTS.preset end
    CFG.customR         = tonumber(GetString("savegame.mod.tdwater.custom.r")) or CFG.customR
    CFG.customG         = tonumber(GetString("savegame.mod.tdwater.custom.g")) or CFG.customG
    CFG.customB         = tonumber(GetString("savegame.mod.tdwater.custom.b")) or CFG.customB
    CFG.shape           = GetString("savegame.mod.tdwater.shape"); if CFG.shape=="" then CFG.shape=DEFAULTS.shape end
    CFG.spread          = tonumber(GetString("savegame.mod.tdwater.spread")) or CFG.spread
    CFG.uiToggleKey     = GetString("savegame.mod.tdwater.uiToggleKey"); if CFG.uiToggleKey=="" then CFG.uiToggleKey = DEFAULTS.uiToggleKey end
    CFG.uiAnchor        = GetString("savegame.mod.tdwater.uiAnchor"); if CFG.uiAnchor=="" then CFG.uiAnchor = DEFAULTS.uiAnchor end
    -- panel persisted position only on first load
    if not panelInitialized then
        local savedX = tonumber(GetString("savegame.mod.tdwater.uiPanelX"))
        local savedY = tonumber(GetString("savegame.mod.tdwater.uiPanelY"))
        if savedX and savedY then
            panelPosX, panelPosY = savedX, savedY
        else
            panelPosX = UiCenter() - panelW/2
            panelPosY = UiMiddle() - panelH/2
        end
        panelInitialized = true
    end
    -- profile handling (IDs 16,30)
    local profIdx = tonumber(GetString("savegame.mod.tdwater.profile")) or 1
    profIdx = clamp(math.floor(profIdx),1,#profileNames)
    CFG.profileIndex = profIdx
    CFG.profileName = profileNames[profIdx]
    local preset = PROFILE_PRESETS[CFG.profileName]
    for k,v in pairs(preset) do CFG[k] = v end
    -- apply droplets adjustments
    if CFG.droplets then
        CFG.radius = CFG.radius * 0.35
        CFG.gravity = CFG.gravity * 3.5
        CFG.drag = clamp(CFG.drag * 0.5, 0.1, 5)
        CFG.velocity = CFG.velocity * 1.2
        CFG.baseCount = math.max(1, math.floor(CFG.baseCount * 1.5))
        CFG.life = CFG.life * 0.6
    end
    -- sanity
    CFG.spread = clamp(CFG.spread, 0.1, 3.0)
end

local function saveNumber(key, value) SetString(key, tostring(value)) end

-- Backwards compat wrapper
local function readConfig() loadBaseConfig() end

----------------------------------------------------------------
-- COLOR LOGIC
----------------------------------------------------------------
local function computeColor(dt, t)
	-- RGB stuff.
	local red,green,blue = 0,0.498,1
	if CFG.colorMode == "Preset" then
		local propColor = CFG.preset
		if propColor == "Classic tdWater" then
			red = 0
			green = 0
			blue = 1
		elseif propColor == "Toxic Chemicals" then
			red = 0
			green = 1
			blue = 0
		elseif propColor == "Oil" then
			red = 0
			green = 0
			blue = 0
		end
	elseif CFG.colorMode == "Custom" then
		red, green, blue = CFG.customR, CFG.customG, CFG.customB
	elseif CFG.colorMode == "Rainbow" then
		local speed = 0.25
		local h = (t * speed) % 1.0
		local s = 0.9
		local v = 1.0
		local i = math.floor(h*6)
		local f = h*6 - i
		local p = v*(1-s)
		local q = v*(1-f*s)
		local tt = v*(1-(1-f)*s)
		if i % 6 == 0 then red,green,blue = v,tt,p
		elseif i == 1 then red,green,blue = q,v,p
		elseif i == 2 then red,green,blue = p,v,tt
		elseif i == 3 then red,green,blue = p,q,v
		elseif i == 4 then red,green,blue = tt,p,v
		else red,green,blue = v,p,q end
	elseif CFG.colorMode == "Random" then
		red = 0.2 + math.random()*0.8
		green = 0.2 + math.random()*0.8
		blue = 0.2 + math.random()*0.8
	end
	return red, green, blue
end

----------------------------------------------------------------
-- EMISSION
----------------------------------------------------------------
local function startEmissionFromRay()
    local ct = GetCameraTransform()
    local pos = ct.pos
    local dir = TransformToParentVec(ct, Vec(0,0,-1))
    local hit, dist, normal, shape = QueryRaycast(pos, dir, 500)
    if hit then
        local hitPoint = VecAdd(pos, VecScale(dir, dist))
        local b = GetShapeBody(shape)
        local t = GetBodyTransform(b)
        emitBody = b
        hitShape = shape
        emitPos = TransformToLocalPoint(t, hitPoint)
        emitDir = TransformToLocalVec(t, normal)
        emitTimer = 0
        emit = true
        shutup = false
        pressureEmitRemaining = 0 -- direct emission
    end
end

local function cycleList(current, list)
    local idx = 1
    for i,v in ipairs(list) do if v==current then idx=i break end end
    idx = idx % #list + 1
    return list[idx]
end

local function cycleMode()
    local order = {"toggle","hold","pressure"}
    CFG.mode = cycleList(CFG.mode, order)
    SetString("savegame.mod.tdwater.mode", CFG.mode)
end

local function cycleShape()
    CFG.shape = cycleList(CFG.shape, {"cone","fan","jet"})
    SetString("savegame.mod.tdwater.shape", CFG.shape)
end

local function cycleUiKey()
    -- Allow cycling through a curated list of logical inputs that are unlikely to clash
    local keys = {"map","flashlight","reload","interact","pause"}
    CFG.uiToggleKey = cycleList(CFG.uiToggleKey, keys)
    SetString("savegame.mod.tdwater.uiToggleKey", CFG.uiToggleKey)
end

local function cycleAnchor()
    local anchors = {"center","topleft","topright","bottomleft","bottomright"}
    CFG.uiAnchor = cycleList(CFG.uiAnchor, anchors)
    SetString("savegame.mod.tdwater.uiAnchor", CFG.uiAnchor)
    -- Also snap panel to anchor when cycling (for legacy users)
    if CFG.uiAnchor == "center" then
        panelPosX = UiCenter() - panelW/2; panelPosY = UiMiddle() - panelH/2
    elseif CFG.uiAnchor == "topleft" then panelPosX, panelPosY = 40, 60
    elseif CFG.uiAnchor == "topright" then panelPosX = UiWidth() - panelW - 40; panelPosY = 60
    elseif CFG.uiAnchor == "bottomleft" then panelPosX = 40; panelPosY = UiHeight() - panelH - 60
    elseif CFG.uiAnchor == "bottomright" then panelPosX = UiWidth() - panelW - 40; panelPosY = UiHeight() - panelH - 60 end
    SetString("savegame.mod.tdwater.uiPanelX", tostring(panelPosX))
    SetString("savegame.mod.tdwater.uiPanelY", tostring(panelPosY))
end

local function cycleProfile(delta)
    CFG.profileIndex = CFG.profileIndex + delta
    if CFG.profileIndex < 1 then CFG.profileIndex = #profileNames end
    if CFG.profileIndex > #profileNames then CFG.profileIndex = 1 end
    SetString("savegame.mod.tdwater.profile", tostring(CFG.profileIndex))
end

-- Pressure burst emission termination
local function stopEmission()
    emit = false
    shutup = true
    pressureEmitRemaining = 0
end

-- Adjustable spread by mouse wheel while holding shift (ID 1)
local function handleWheel()
    local dw = InputValue("mousewheel")
    if dw ~= 0 and InputDown("shift") then
        CFG.spread = clamp(CFG.spread + dw * 0.1, 0.1, 3.0)
        saveNumber("savegame.mod.tdwater.spread", CFG.spread)
    end
end

-- Compute direction variance based on shape & spread
local function randomSprayDir(baseDir)
    local variance = CFG.spread
    local rv = rndVec(variance * 0.3)
    if CFG.shape == "cone" then
        rv = rndVec(variance * 0.5)
    elseif CFG.shape == "fan" then
        rv = Vec(rv[1]*1.2, rv[2]*0.1, rv[3])
    elseif CFG.shape == "jet" then
        rv = VecScale(rv, 0.15)
    end
    return VecNormalize(VecAdd(baseDir, rv))
end

local function doEmission(dt)
    if not emit then return end
    if not bodyValid(emitBody) then stopEmission() return end
    readConfig()
    handleWheel()
    local t = GetTime()
    emitTimer = emitTimer + dt
    steamTimer = steamTimer + dt

    -- Pressure mode active burst handling
    if pressureEmitRemaining > 0 then
        pressureEmitRemaining = pressureEmitRemaining - dt
        if pressureEmitRemaining <= 0 then stopEmission() return end
    end

    local secondary = CFG.secondaryBoost and InputDown("secondary")
    local radius = CFG.radius * (secondary and 0.4 or 1.0)
    local vel    = CFG.velocity * (secondary and 1.6 or 1.0)
    local count  = CFG.baseCount * (secondary and 2 or 1)

    -- Pressure scaling if burst
    if pressureEmitRemaining > 0 then
        local mult = 1 + pressureCharge * 3.0
        count = math.floor(count * mult)
        vel = vel * (1 + pressureCharge * 1.0)
        radius = radius * (1 - pressureCharge * 0.25)
    end

    local red, green, blue = computeColor(dt, t)
    local bt = GetBodyTransform(emitBody)
    local pos = TransformToParentPoint(bt, emitPos)
    local dir = TransformToParentVec(bt, emitDir)
    lastSoundPos = pos

    if snd then PlayLoop(snd, pos, clamp(0.15 + 0.02*count, 0, 1)) end

    ParticleReset()
    ParticleType("smoke")
    ParticleRadius(radius)
    ParticleAlpha(CFG.alphaStart, CFG.alphaEnd)
    ParticleGravity(CFG.gravity)
    ParticleDrag(CFG.drag)
    ParticleColor(red, green, blue)
    ParticleCollide(0,1,"linear",0.02)
    ParticleFlags(256)

    for i=1,count do
        local sprayDir = randomSprayDir(dir)
        local p = VecAdd(pos, VecAdd(VecScale(sprayDir, radius*0.5), rndVec(radius*0.4)))
        local v = VecScale(VecAdd(sprayDir, rndVec(0.1)), vel)
        v = VecAdd(v, VecScale(GetBodyVelocityAtPos(emitBody, pos), 0.5))
        local l = rnd(CFG.life*0.6, CFG.life*1.3)
        SpawnParticle(p, v, l)
    end

    -- Steam effect (IDs 5 & 7): periodic check near fires / hot metal
    if steamTimer > 0.15 then
        steamTimer = 0
        if hitShape ~= 0 then
            local wp = pos
            local matType = nil
            local ok, mtype = pcall(GetShapeMaterialAtPosition, hitShape, wp)
            if ok then matType = mtype end
            local fireHit, fPos = QueryClosestFire(wp, 2.5) -- returns maybe different signature; safety
            if fireHit or (matType and (string.find(matType, "metal") or string.find(matType, "brick"))) then
                ParticleReset()
                ParticleType("smoke")
                ParticleRadius(radius*0.6, radius*1.2)
                ParticleAlpha(0.6, 0.0, "easeout", 0.05, 0.8)
                ParticleGravity(-5)
                ParticleDrag(1.5)
                ParticleColor(0.9,0.95,1.0)
                ParticleCollide(0,1)
                for i=1,math.max(2, math.floor(count*0.3)) do
                    local sd = randomSprayDir(dir)
                    local sp = VecAdd(pos, rndVec(radius*0.3))
                    local sv = VecScale(sd, vel*0.3)
                    SpawnParticle(sp, sv, rnd(4,8))
                end
            end
        end
    end
end

----------------------------------------------------------------
-- INIT / UPDATE / TICK
----------------------------------------------------------------

function init()
	RegisterTool("tdwater", "TeardownWater", "MOD/vox/smokegun.vox")
	SetBool("game.tool.tdwater.enabled", true)
	snd = LoadLoop("MOD/snd/watta.ogg")
	math.randomseed(GetTime() * 100000)
	readConfig()
end

function update(dt)
	if emit and shutup then stopEmission() end
	if emit then doEmission(dt) end
end

-- TICK logic enhancements (IDs 1,2,11,12,13,14,16)
function tick(dt)
    readConfig()
    local selected = (GetString("game.player.tool") == "tdwater")
    if selected then
        -- Handle live key capture (when user clicked Bind UI Key)
        if bindingCapture then
            local k = ""
            if InputLastPressedKey then
                k = InputLastPressedKey()
            else
                -- Fallback scan of common logical inputs if API lacks InputLastPressedKey
                local candidates = {"map","flashlight","reload","interact","pause","jump","crouch","tool_group_next","tool_group_prev"}
                for _,c in ipairs(candidates) do if InputPressed(c) then k = c break end end
            end
            if k ~= nil and k ~= "" then
                -- Filter out mouse movement pseudo keys if any
                if k ~= "lmb" and k ~= "rmb" and k ~= "mmb" then
                    CFG.uiToggleKey = k
                    SetString("savegame.mod.tdwater.uiToggleKey", CFG.uiToggleKey)
                    bindingCapture = false
                end
            end
        end
        handleWheel()
        -- Alt hotkey: configurable logical key to toggle UI
        if not bindingCapture and InputPressed(CFG.uiToggleKey) then ui = not ui end
        -- Mode handling
        if CFG.mode == "hold" then
            if GetBool("game.player.canusetool") then
                if InputPressed("usetool") then startEmissionFromRay() end
                if InputReleased("usetool") then stopEmission() end
            end
        elseif CFG.mode == "toggle" then
            if GetBool("game.player.canusetool") and InputPressed("usetool") then
                if emit then stopEmission() else startEmissionFromRay() end
            end
        elseif CFG.mode == "pressure" then
            if GetBool("game.player.canusetool") then
                if InputDown("usetool") and pressureEmitRemaining<=0 and not emit then
                    pressureCharge = clamp(pressureCharge + dt*0.5, 0, 1)
                end
                if InputReleased("usetool") then
                    if pressureCharge > 0.05 then
                        startEmissionFromRay()
                        pressureEmitRemaining = 1.0 + pressureCharge * 1.5
                    end
                    pressureCharge = 0
                end
            end
        end
        -- Reposition emitter (unchanged) unless using modifiers
        if emit and InputPressed("reload") and not InputDown("crouch") and not InputDown("jump") then
            startEmissionFromRay()
        end
        -- Mode cycle (reload + crouch) ID 13
        if InputPressed("reload") and InputDown("crouch") then cycleMode() end
        -- Shape cycle (reload + jump)
        if InputPressed("reload") and InputDown("jump") then cycleShape() end
        -- Profile cycle (tool group next/prev) ID 16
        if InputPressed("tool_group_next") then cycleProfile(1) end
        if InputPressed("tool_group_prev") then cycleProfile(-1) end
        -- Toggle config UI (reload + flashlight)
        if InputPressed("reload") and InputDown("flashlight") then ui = not ui end
        -- HUD message ID 12
        local status = "";
        if CFG.mode=="pressure" then
            if pressureEmitRemaining>0 then status="Burst" elseif pressureCharge>0 then status=string.format("Charging %.0f%%", pressureCharge*100) else status="Idle" end
        else
            status = emit and "Emitting" or (CFG.mode=="hold" and "Hold LMB" or "Click to start")
        end
        SetString("game.tool.tdwater.ammo.display", status)
    end
    -- Pause menu buttons (extended config)
    if PauseMenuButton("tdWater: Stop emitting") then shutup = true end
    if PauseMenuButton("tdWater: Toggle Config UI") then ui = not ui end
    if PauseMenuButton("tdWater: Mode ("..CFG.mode..")") then cycleMode() end
    if PauseMenuButton("tdWater: Shape ("..CFG.shape..")") then cycleShape() end
    if PauseMenuButton("tdWater: Profile ("..CFG.profileName..") next") then cycleProfile(1) end
    if PauseMenuButton("tdWater: Cycle color mode ("..CFG.colorMode..")") then
        local order = {"Preset","Custom","Rainbow","Random"}
        CFG.colorMode = cycleList(CFG.colorMode, order)
        SetString("savegame.mod.tdwater.colormode", CFG.colorMode)
    end
    if PauseMenuButton("tdWater: Droplets "..(CFG.droplets and "ON" or "OFF")) then
        local nv = not CFG.droplets
        SetBool("savegame.mod.tdwater.droplets", nv)
    end
    if PauseMenuButton("tdWater: SecondaryBoost "..(CFG.secondaryBoost and "ON" or "OFF")) then
        local nv = not CFG.secondaryBoost
        SetBool("savegame.mod.tdwater.secondaryBoost", nv)
    end
    if PauseMenuButton("tdWater: Spread -") then
        CFG.spread = clamp(CFG.spread - 0.1, 0.1, 3.0)
        saveNumber("savegame.mod.tdwater.spread", CFG.spread)
    end
    if PauseMenuButton("tdWater: Spread +") then
        CFG.spread = clamp(CFG.spread + 0.1, 0.1, 3.0)
        saveNumber("savegame.mod.tdwater.spread", CFG.spread)
    end
    if PauseMenuButton("tdWater: UI key ("..CFG.uiToggleKey..")") then cycleUiKey() end
    if PauseMenuButton("tdWater: UI anchor ("..CFG.uiAnchor..")") then cycleAnchor() end
    if PauseMenuButton("tdWater: Reset UI panel position") then
        panelPosX = UiCenter() - panelW/2; panelPosY = UiMiddle() - panelH/2
        SetString("savegame.mod.tdwater.uiPanelX", tostring(panelPosX))
        SetString("savegame.mod.tdwater.uiPanelY", tostring(panelPosY))
    end
end

-- ===== CLEAN UI REBUILD =====
-- New constants
local UI_ROW = 26
local UI_PAD = 10
local PANEL_W = 520
local PANEL_H = 540
panelW = PANEL_W; panelH = PANEL_H
local cleanScroll = 0
local cleanScrollTarget = 0

-- Unused legacy structures kept for compatibility but not used: panelSectionOpen
local sectionOrder = {
    {id="main", label="Main"},
    {id="behavior", label="Behavior"},
    {id="visuals", label="Visuals"},
    {id="keys", label="Keys"},
}
local sectionOpen = {main=true, behavior=true, visuals=true, keys=true}

local function uiResetScrollIfNeeded(totalHeight)
    local maxScroll = math.max(0, totalHeight - (panelH - 60))
    if cleanScrollTarget > 0 then cleanScrollTarget = 0 end
    if -cleanScrollTarget > maxScroll then cleanScrollTarget = -maxScroll end
    cleanScroll = cleanScroll + (cleanScrollTarget - cleanScroll) * 0.25
end

local function uiScrollWheel()
    local w = InputValue("mousewheel")
    if w ~= 0 then
        cleanScrollTarget = cleanScrollTarget - w * 40
    end
end

local function uiDragPanel(mx,my)
    if not panelDragging and InputPressed("lmb") then
        if mx>panelPosX and mx<panelPosX+panelW and my>panelPosY and my<panelPosY+32 then
            panelDragging = true
            panelDragOffX = mx - panelPosX
            panelDragOffY = my - panelPosY
        end
    end
    if panelDragging then
        if InputDown("lmb") then
            panelPosX = clamp(mx - panelDragOffX, 0, UiWidth()-panelW)
            panelPosY = clamp(my - panelDragOffY, 0, UiHeight()-40)
        else
            panelDragging = false
            SetString("savegame.mod.tdwater.uiPanelX", tostring(panelPosX))
            SetString("savegame.mod.tdwater.uiPanelY", tostring(panelPosY))
        end
    end
end

local function rowLabel(text)
    UiFont("regular.ttf",16)
    UiColor(0,0,0,1)
    UiText(text)
end

local function sliderRow(label, key, mi, ma, step, fmt)
    UiPush()
        rowLabel(label)
        UiTranslate(180, -18)
        local v = CFG[key] or 0
        v = UiSlider("ui/hud/dot.png","x", v, mi, ma)
        if step and step>0 then v = math.floor(v/step+0.5)*step end
        if v < mi then v = mi elseif v > ma then v = ma end
        if v ~= CFG[key] then
            CFG[key] = v
            saveNumber("savegame.mod.tdwater."..key, v)
        end
        UiTranslate(220, -2)
        UiFont("regular.ttf",14)
        UiText(string.format(fmt or "%.2f", v))
    UiPop()
    UiTranslate(0, UI_ROW)
end

local function toggleRow(label, key)
    UiPush()
        local on = CFG[key]
        UiFont("regular.ttf",16)
        UiColor(on and 0.15 or 0.5, on and 0.6 or 0.2, on and 0.2 or 0.2,1)
        if UiTextButton(label..": "..(on and "ON" or "OFF"), 180, UI_ROW-4) then
            on = not on
            CFG[key] = on
            SetBool("savegame.mod.tdwater."..key, on)
        end
        UiColor(1,1,1,1)
    UiPop()
    UiTranslate(0, UI_ROW)
end

local function enumRow(label, key, list)
    UiPush()
        UiFont("regular.ttf",16)
        if UiTextButton(label..": "..CFG[key], 200, UI_ROW-4) then
            CFG[key] = cycleList(CFG[key], list)
            SetString("savegame.mod.tdwater."..key, CFG[key])
        end
    UiPop()
    UiTranslate(0, UI_ROW)
end

local function section(label, id)
    UiPush()
        UiFont("bold.ttf",18)
        local open = sectionOpen[id]
        local prefix = open and "[-]" or "[+]"
        if UiTextButton(prefix.." "..label, 160, UI_ROW-4) then
            sectionOpen[id] = not open
            open = sectionOpen[id]
        end
    UiPop()
    UiTranslate(0, UI_ROW-6)
    return sectionOpen[id]
end

local function drawCleanSettingsPanel()
    local mx,my = UiGetMousePos()
    uiDragPanel(mx,my)
    uiScrollWheel()

    UiPush()
    UiMakeInteractive()
    UiWindow(UiWidth(), UiHeight())
    UiTranslate(panelPosX, panelPosY)
    -- Panel background
    UiColor(1,1,1,1); UiRect(panelW, panelH)
    -- Header
    UiColor(0.12,0.12,0.16,1); UiRect(panelW,32)
    UiTranslate(12,6)
    UiFont("bold.ttf",20); UiColor(1,1,1,1); UiText("tdWater Settings")
    UiTranslate(panelW-160, -2)
    UiFont("regular.ttf",16)
    if UiTextButton("Close", 70, 24) then ui=false bindingCapture=false end
    UiTranslate(80,0)
    if UiTextButton("Reset", 70, 24) then
        panelPosX = UiCenter()-panelW/2; panelPosY = UiMiddle()-panelH/2
        SetString("savegame.mod.tdwater.uiPanelX", tostring(panelPosX))
        SetString("savegame.mod.tdwater.uiPanelY", tostring(panelPosY))
    end

    -- Content area
    UiTranslate(-panelW+UI_PAD, 40)
    UiPush()
        UiTranslate(0, cleanScroll)
        local startY = UiHeight()
        local contentStart = 0
        local beforeY = 0

        -- MAIN SECTION
        if section("Main","main") then
            enumRow("Mode","mode",{"hold","toggle","pressure"})
            sliderRow("Radius","radius",0.2,1.5,0.01,"%.2f")
            sliderRow("Base Count","baseCount",1,20,1,"%d")
            sliderRow("Velocity","velocity",2,30,0.5,"%.1f")
        end

        if section("Behavior","behavior") then
            toggleRow("Droplets","droplets")
            toggleRow("Secondary Boost","secondaryBoost")
            enumRow("Shape","shape", {"cone","fan","jet"})
            sliderRow("Spread","spread",0.1,3.0,0.01,"%.2f")
            if CFG.mode == "pressure" then
                UiFont("regular.ttf",16); UiText("Pressure: "..string.format("%.0f%%", pressureCharge*100))
                UiTranslate(0, UI_ROW)
            end
        end

        if section("Visuals","visuals") then
            sliderRow("Gravity","gravity",-80,-5,1,"%d")
            sliderRow("Drag","drag",0,3,0.05,"%.2f")
            enumRow("Color Mode","colorMode", {"Preset","Custom","Rainbow","Random"})
            UiFont("regular.ttf",16); UiText("Preset: "..CFG.preset); UiTranslate(0, UI_ROW)
        end

        if section("Keys","keys") then
            UiFont("regular.ttf",16); UiText("UI Toggle Key: "..CFG.uiToggleKey); UiTranslate(0, UI_ROW)
            if not bindingCapture then
                if UiTextButton("Rebind UI Key", 160, UI_ROW-4) then bindingCapture=true end
            else
                UiColor(1,0.7,0,1); UiText("Press a key...", true); UiColor(0,0,0,1)
                UiTranslate(0, UI_ROW)
                if UiTextButton("Cancel", 120, UI_ROW-4) then bindingCapture=false end
            end
            UiTranslate(0, UI_ROW)
            UiFont("regular.ttf",16); UiText("Anchor: "..CFG.uiAnchor); UiTranslate(0, UI_ROW)
            if UiTextButton("Cycle Anchor", 160, UI_ROW-4) then cycleAnchor() end
            UiTranslate(0, UI_ROW)
            if UiTextButton("Profile Next", 160, UI_ROW-4) then cycleProfile(1) end
        end

        local endY = UiGetMousePos() -- just to ensure call; cannot measure directly so approximate content height by translation
        local contentHeight = 0
        -- Approximate content height by counting rows: each slider toggle row adds UI_ROW, plus headers
        local rows = 0
        if sectionOpen.main then rows = rows + 4 end
        if sectionOpen.behavior then rows = rows + (CFG.mode=="pressure" and 6 or 5) end
        if sectionOpen.visuals then rows = rows + 4 end
        if sectionOpen.keys then rows = rows + (bindingCapture and 8 or 7) end
        -- plus headers overhead
        rows = rows + 4
        contentHeight = rows * UI_ROW + 60
        uiResetScrollIfNeeded(contentHeight)
    UiPop()

    -- Simple scrollbar
    UiPush()
        UiTranslate(panelW-14, 40)
        UiColor(0.85,0.85,0.85,1); UiRect(4, panelH-50)
        local visible = panelH-60
        local total = math.max(visible, (sectionOpen.main and 4 or 0)+(sectionOpen.behavior and 6 or 0)+(sectionOpen.visuals and 4 or 0)+(sectionOpen.keys and 8 or 0))*UI_ROW
        local maxScroll = math.max(1, total - visible)
        local scrollNorm = (-cleanScrollTarget) / maxScroll
        if scrollNorm < 0 then scrollNorm=0 elseif scrollNorm>1 then scrollNorm=1 end
        local barH = clamp((visible/total)* (panelH-50), 30, panelH-50)
        local barY = (panelH-50 - barH) * scrollNorm
        UiTranslate(0, barY)
        UiColor(0.30,0.60,1,1); UiRect(4, barH)
    UiPop()

    UiPop()
end

-- Override old drawConfigUI usage in draw()
function draw()
    if not (GetString("game.player.tool") == "tdwater") then return end
    UiPush()
    local bloom = clamp(CFG.radius * 25 * (1 + (CFG.spread-1)*0.5), 8, 60)
    UiTranslate(UiCenter(), UiMiddle())
    UiAlign("center middle")
    UiColor(0,0.6,1,0.25); UiCircle(bloom)
    UiColor(0,0.4,0.9,0.75); UiCircleOutline(bloom,2)
    UiPop()

    UiPush()
    UiTranslate(40, UiHeight()-140)
    UiFont("bold.ttf", 20)
    UiColor(0,0,0,0.4); UiRect(220,130); UiColor(1,1,1,1)
    UiTranslate(10,10)
    UiText("Mode: "..CFG.mode, true)
    UiText("Shape: "..CFG.shape, true)
    UiText("Profile: "..CFG.profileName, true)
    if CFG.mode=="pressure" then UiText(string.format("Pressure: %.0f%%", pressureCharge*100), true) end
    UiText(string.format("Spread: %.2f", CFG.spread), true)
    local r,g,b = computeColor(0, GetTime())
    UiColor(r,g,b,1); UiRect(40,20); UiColor(1,1,1,1)
    UiPop()

    if ui then drawCleanSettingsPanel() end
end
