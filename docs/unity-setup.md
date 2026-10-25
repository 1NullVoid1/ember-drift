# Setting up Ember Drift in Unity

The web prototype stays at the top of this repo (it powers the play link). The Unity game lives in the `EmberDrift/` folder.

## 1. Install the tools
1. **Unity Hub**: https://unity.com/download. Sign in with a free Unity account and choose the Personal (free) licence.
2. **Unity 6 LTS**: in Unity Hub go to *Installs → Install Editor* and pick the newest **Unity 6 (LTS)**. On the modules screen, tick **Android Build Support** (including OpenJDK and the Android SDK & NDK) so the game can run on phones. Leave Microsoft Visual Studio ticked; it's the code editor.
3. **GitHub Desktop**: https://desktop.github.com. Sign in as 1NullVoid1.

## 2. Get the repo onto your PC
In GitHub Desktop choose *File → Clone repository*, pick `1NullVoid1/ember-drift`, and note the folder it saves to (for example `Documents\GitHub\ember-drift`).

## 3. Create the Unity project inside it
In Unity Hub choose *New project*, pick the **Universal 3D** template (URP), name it **EmberDrift**, and set the location to the `ember-drift` folder from step 2. Click *Create project* and wait for the editor to open.

## 4. Push it
Close Unity, open GitHub Desktop, type a summary such as "Create Unity project", click **Commit to main**, then **Push origin**. Tell Claude when it's pushed.

## Day to day
- When Claude pushes new scripts: GitHub Desktop → **Fetch origin**, then **Pull**. Unity picks up the changes when you switch back to it.
- When you change something in Unity: save, then in GitHub Desktop commit and push it so Claude can see it.
