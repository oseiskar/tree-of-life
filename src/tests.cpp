
#include <trie.hpp>
#include <tree.hpp>
#include <json.hpp>
#include <utf8.hpp>

#include <assert.h>

template <class Trie>
void trie_structure_json(const Trie &trie, JsonWriter &json) {
    json.begin('{');
    for(typename Trie::const_iterator c = trie.children.begin(); 
        c != trie.children.end();
        ++c)
    {
        json.key(to_string(c->first));
        trie_structure_json(c->second, json);
    }
    json.end('}');
}

template <class Trie>
std::string trie_structure_json(const Trie &trie) {
    JsonWriter json;
    trie_structure_json(trie,json);
    return json.to_string();
}

#define ASSERT_THROWS(type, x) try { x; assert(false); } catch(type &) {}

using std::string;

void run_json_tests() {
    {
    JsonWriter json;
    assert(json.to_string() == string(""));
    
    json.begin('{')
        .key("foo")
        .value(2)
        .key("bar")
        .begin('[')
            .value("AC/DC\n\t\r\b \\ ")
            .null_value()
            .begin('{')
            .end('}')
            .value(true)
            .value(2.5)
            .value(3)
        .end(']')
    .end('}');
    
    assert(json.to_string() == string(
        "{\"foo\":2,\"bar\":["
        "\"AC\\/DC\\n\\t\\r\\u0008 \\\\ \","
        "null,{},true,2.5,3]}"));
    }
    
    {
    JsonWriter json;
    
    ASSERT_THROWS(JsonWriter::error, json.end('}') );
    ASSERT_THROWS(JsonWriter::error, json.key("foo") );
    
    json.begin('{');
    ASSERT_THROWS(JsonWriter::error, json.value(1) );
    ASSERT_THROWS(JsonWriter::error, json.begin('{') );
    ASSERT_THROWS(JsonWriter::error, json.end(']') );
    json.key("foo");
    ASSERT_THROWS(JsonWriter::error, json.key("bar") );
    json.begin('[');
    ASSERT_THROWS(JsonWriter::error, json.key("baz") );
    json.value(1);
    json.end(']');
    json.end('}');
    ASSERT_THROWS(JsonWriter::error, json.value(1) );
    ASSERT_THROWS(JsonWriter::error, json.key("fsd") );
    ASSERT_THROWS(JsonWriter::error, json.end('}') );
    ASSERT_THROWS(JsonWriter::error, json.begin('[') );
    }
    
    {
    JsonWriter json;
    json.begin('[');
    json.value(1);
    json.end(']');
    assert(json.to_string() == string("[1]"));
    }
    
    {
    JsonWriter json;
    json.value(1);
    ASSERT_THROWS(JsonWriter::error, json.value(2) );
    ASSERT_THROWS(JsonWriter::error, json.begin('{') );
    ASSERT_THROWS(JsonWriter::error, json.end('}') );
    assert(json.to_string() == string("1"));
    }
    
    std::cerr << "json tests passed" << std::endl;
    
}

void run_trie_tests() {
    UnicodeTrie<string> t;
    StringTrie<string> string_trie;
    
    std::string one("1"), two("2"), three("3");
    
    {
    t.insert("abcd", one);
    
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}}}}}");
    assert(t.lookup("foobar") == NULL);
    assert(t.get("abcd") == one);
    
    t.insert("abf", two);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.lookup("ab") == NULL);
    
    t.insert("ab", three);
    assert(trie_structure_json(t) == "{\"a\":{\"b\":{\"c\":{\"d\":{}},\"f\":{}}}}");
    assert(t.get("abcd") == one);
    assert(t.get("abf") == two);
    assert(t.get("ab") == three);
    
    ASSERT_THROWS(std::runtime_error, t.insert("abcd", two));
    t.insert("abcd", two, true);
    assert(t.get("abcd") == two);
    
    string_trie.copy_char_trie(t);
    assert(trie_structure_json(string_trie) == "{\"ab\":{\"cd\":{},\"f\":{}}}");
    }
    
    {
    UnicodeTrie<int> utf8_trie;
    StringTrie<int> utf8_string_trie;
    utf8_trie.insert("\xC3\xA0", 1);
    utf8_trie.insert("\xC3\xA1", 2);
    assert(trie_structure_json(utf8_trie) == "{\"\xC3\xA0\":{},\"\xC3\xA1\":{}}");
    assert(utf8_trie.get("\xC3\xA0") == 1);
    assert(utf8_trie.get("\xC3\xA1") == 2);
    utf8_string_trie.copy_char_trie(utf8_trie);
    assert(trie_structure_json(utf8_string_trie) == "{\"\xC3\xA0\":{},\"\xC3\xA1\":{}}");
    
    JsonWriter utf8_json;
    utf8_string_trie.write_json(utf8_json);
    assert(utf8_json.to_string() == string("{\"c\":{\"\xC3\xA0\":{\"v\":1},\"\xC3\xA1\":{\"v\":2}}}"));
    
    JsonWriter other_json;
    other_json.begin("{");
    other_json.key("root");
    other_json.value(utf8_string_trie);
    other_json.end("}");
    assert(other_json.to_string() ==
        string("{\"root\":{\"c\":{\"\xC3\xA0\":{\"v\":1},\"\xC3\xA1\":{\"v\":2}}}}"));
    }
    
    std::cerr << "trie tests passed" << std::endl;
}

void run_tree_of_life_tests() {
    
    std::istringstream newick_input(
        "((Raccoon_ott2,'_bear_ott3')land_ott1,('''sEA''_lion_ott5',seal_ott6),'(dog),;_ott7');"
    );
    
    TreeOfLife tol(newick_input);
    JsonWriter json;
    tol.write_json(json);
    
    string expected(
        "{"
            "\"data\":{"
                "\"i\":1,"
                "\"s\":5,"
                "\"c\":["
                    "{"
                        "\"i\":2,"
                        "\"n\":\"land\","
                        "\"s\":2,"
                        "\"c\":["
                            "{\"i\":3,\"n\":\"Raccoon\"},"
                            "{\"i\":4,\"n\":\"bear\"}"
                        "]"
                    "},"
                    "{"
                        "\"i\":5,"
                        "\"s\":2,"
                        "\"c\":["
                            "{\"i\":6,\"n\":\"'sEA' lion\"},"
                            "{\"i\":7,\"n\":\"seal\"}"
                        "]"
                    "},"
                    "{\"i\":8,\"n\":\"(dog),;\"}"
                "]"
            "},"
            "\"parents\":{"
                "\"2\":1,"
                "\"3\":2,"
                "\"4\":2,"
                "\"5\":1,"
                "\"6\":5,"
                "\"7\":5,"
                "\"8\":1"
            "}"
        "}"
    );
    
    assert(json.to_string() == expected);
    
    std::cerr << "tol tests passed" << std::endl;
}

void run_misc_tests() {
    
    assert(to_string(123) == string("123"));
    assert(to_string('c') == string("c"));
    
    Utf8::String utf8 = Utf8::decode("\xC3\xA0 10\xE2\x82\xAC");
    assert(utf8.size() == 5);
    assert(utf8[0] == string("\xC3\xA0"));
    assert(utf8[1] == string(" "));
    assert(utf8[2] == string("1"));
    assert(utf8[3] == string("0"));
    assert(utf8[4] == string("\xE2\x82\xAC"));
    
    std::cerr << "misc tests passed" << std::endl;
}

int main() {
    run_misc_tests();
    run_json_tests();
    run_trie_tests();
    run_tree_of_life_tests();
    
    std::cerr << "all passed" << std::endl;
    return 0;
}
