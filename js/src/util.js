import dateFormat from "dateformat"

export function isodateToHuman(d, adjust) {
    if (d.getUTCHours() + d.getUTCMinutes() + d.getUTCSeconds() == 0) { 
        if (adjust) {
            d.setDate(d.getDate() - 1);
        }
        return dateFormat(d,"d mmm yyyy");
    }
    else {
        return dateFormat(d,"d mmm yyyy HH:MM:ss");
    }
}

export function formatNumber(v, d) {
    return Number(v).toFixed(d).replace(/(\d)(?=(\d{3})+(?:\.\d+)?$)/g, '$1,');
}

/* takes a string phrase and breaks it into separate phrases 
 *    no bigger than 'maxwidth', breaks are made at complete words.*/
export function wrapLabel(str, maxwidth){
    var sections = [];
    var words = str.split(" ");
    var temp = "";

    words.forEach(function(item, index){
        if(temp.length > 0)
        {
            var concat = temp + ' ' + item;

            if(concat.length > maxwidth){
                sections.push(temp);
                temp = "";
            }
            else{
                if(index == (words.length-1))
                {
                    sections.push(concat);
                    return;
                }
                else{
                    temp = concat;
                    return;
                }
            }
        }

        if(index == (words.length-1))
        {
            sections.push(item);
            return;
        }

        if(item.length < maxwidth) {
            temp = item;
        }
        else {
            sections.push(item);
        }

    });

    return sections;
}

