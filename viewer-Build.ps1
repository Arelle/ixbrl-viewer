function viewer-Build {

    $npmPath = GetCheckedFullPathToNpm

    Push-Location $PSScriptRoot
    try {
        Exec { . $npmPath install }
        Exec { . $npmPath run font }
        Exec { . $npmPath run prod }
    }
    finally {
        Pop-Location
    }
}

function viewer-Push {

    param(
        [Parameter(Mandatory = $True)]
        [ValidateNotNull()]
        [string]$Version,

        [Parameter(Mandatory = $True)]
        [ValidateNotNull()]
        [string]$ApiKey
    )

    $nugetPath = GetCheckedFullPathToNuget

    Push-Location $PSScriptRoot
    try {
        Exec { . $nugetPath pack -version $Version }
        Exec { . $nugetPath push iXBRLViewerPlugin.$Version.nupkg -ApiKey $ApiKey -Source 'https://nuget.pkg.github.com/mmssolutionsio/index.json' }
    }
    finally {
        Pop-Location
    }
}

function GetCheckedFullPathToNpm {

    $npmFindResult = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -eq $npmFindResult) {
        throw "Install nuget using choco install ``choco install nodejs``"
    }

    Write-Output $npmFindResult.Source
}

function GetCheckedFullPathToNuget {
    $nugetFindResult = Get-Command nuget -ErrorAction SilentlyContinue
    if ($null -eq $nugetFindResult) {
        throw "Install nuget using choco install ``choco install nuget.commandline``"
    }

    Write-Output $nugetFindResult.Source
}